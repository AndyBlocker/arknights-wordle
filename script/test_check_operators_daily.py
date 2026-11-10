"""Operational tests for the read-only daily data check."""

from copy import deepcopy
from datetime import date, timedelta
import fcntl
import json
from pathlib import Path
import signal
import tempfile
import unittest
from unittest.mock import patch

import check_operators_daily as daily
import install_daily_check_cron as cron
import update_operators as updater


class DailyCheckTests(unittest.TestCase):
  def setUp(self):
    self.temporary = tempfile.TemporaryDirectory()
    self.addCleanup(self.temporary.cleanup)
    self.folder = Path(self.temporary.name)
    self.source = self.folder / 'operators.json'
    snapshot = json.loads(updater.DEFAULT_OUTPUT.read_text())
    self.rows = deepcopy(snapshot[:2])
    metadata = json.loads(updater.DEFAULT_OUTPUT.with_name('operators.meta.json').read_text())
    self.as_of = date.fromisoformat(metadata['as_of'])
    self.original = updater.json_bytes(self.rows)
    self.source.write_bytes(self.original)
    self.state = self.folder / 'state'

  def run_with_rows(self, rows):
    with patch.object(updater, 'fetch_rows', return_value=(rows, [])):
      return daily.run_check(self.source, self.state, self.as_of)

  def status(self):
    return json.loads((self.state / daily.STATUS_NAME).read_text())

  def assert_read_only(self):
    self.assertEqual(self.source.read_bytes(), self.original)
    self.assertFalse(self.source.with_name('operators.meta.json').exists())

  def new_operator(self):
    row = deepcopy(self.rows[0])
    row.update({'干员': '测试新干员', '干员序号': '99999',
      '上线时间': self.as_of.isoformat() + ' 12:00:00'})
    return row

  def test_unchanged_and_reordered_data_is_up_to_date(self):
    self.assertEqual(self.run_with_rows(list(reversed(self.rows))), 0)
    status = self.status()
    self.assertEqual(status['status'], 'up-to-date')
    self.assertIs(status['needs_update'], False)
    self.assertEqual(status['consecutive_errors'], 0)
    self.assert_read_only()

  def test_new_operator_and_changed_field_are_reported_without_writing(self):
    rows = deepcopy(self.rows) + [self.new_operator()]
    rows[0]['满级攻击'] = str(int(rows[0]['满级攻击']) + 1)
    self.assertEqual(self.run_with_rows(rows), 0)
    status = self.status()
    self.assertEqual(status['status'], 'update-available')
    self.assertIs(status['needs_update'], True)
    self.assertEqual(status['changes']['added'], ['测试新干员'])
    self.assertEqual(status['changes']['changed_existing_count'], 1)
    self.assert_read_only()

  def test_api_failure_is_error_and_retains_last_success(self):
    self.run_with_rows(self.rows)
    last_success = self.status()['last_success_at']
    with patch.object(updater, 'fetch_rows', side_effect=OSError('network failed')):
      self.assertEqual(daily.run_check(self.source, self.state, self.as_of), 2)
    status = self.status()
    self.assertEqual(status['status'], 'error')
    self.assertIsNone(status['needs_update'])
    self.assertEqual(status['last_success_at'], last_success)
    self.assertEqual(status['consecutive_errors'], 1)
    self.assertEqual(status['error']['type'], 'OSError')
    self.assertIn('network failed', (self.state / 'daily-check.log').read_text())
    self.assert_read_only()

  def test_schema_failure_is_error_not_update_available(self):
    rows = deepcopy(self.rows)
    del rows[0]['满级生命']
    self.assertEqual(self.run_with_rows(rows), 2)
    self.assertEqual(self.status()['status'], 'error')
    self.assertIsNone(self.status()['needs_update'])
    self.assert_read_only()

  def test_future_operator_is_excluded(self):
    row = self.new_operator()
    row['上线时间'] = (self.as_of + timedelta(days=1)).isoformat() + ' 00:00:00'
    self.assertEqual(self.run_with_rows(self.rows + [row]), 0)
    self.assertEqual(self.status()['status'], 'up-to-date')
    self.assertEqual(self.status()['excluded_future'], ['测试新干员'])

  def test_invalid_upstream_date_fails(self):
    rows = deepcopy(self.rows)
    rows[0]['上线时间'] = 'not a date'
    self.assertEqual(self.run_with_rows(rows), 2)
    self.assertEqual(self.status()['status'], 'error')

  def test_invalid_local_snapshot_does_not_fetch(self):
    self.source.write_text('[]')
    with patch.object(updater, 'fetch_rows') as fetch:
      self.assertEqual(daily.run_check(self.source, self.state, self.as_of), 2)
      fetch.assert_not_called()
    self.assertEqual(self.status()['status'], 'error')

  def test_disappearing_operator_is_error(self):
    self.assertEqual(self.run_with_rows(self.rows[:1]), 2)
    self.assertEqual(self.status()['status'], 'error')
    self.assertIn('disappeared', self.status()['error']['message'])

  def test_concurrent_run_does_not_replace_status_or_fetch(self):
    self.run_with_rows(self.rows)
    before = (self.state / daily.STATUS_NAME).read_bytes()
    with (self.state / 'daily-check.lock').open('a+') as lock:
      fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
      with patch.object(updater, 'fetch_rows') as fetch:
        self.assertEqual(daily.run_check(self.source, self.state, self.as_of), 75)
        fetch.assert_not_called()
    self.assertEqual((self.state / daily.STATUS_NAME).read_bytes(), before)

  def test_total_deadline_records_error(self):
    def hit_deadline():
      signal.raise_signal(signal.SIGALRM)
    with patch.object(updater, 'fetch_rows', side_effect=hit_deadline):
      self.assertEqual(daily.run_check(self.source, self.state, self.as_of), 2)
    self.assertEqual(self.status()['error']['type'], 'CheckDeadlineExceeded')
    self.assertIsNone(self.status()['needs_update'])
    self.assert_read_only()


class CronInstallationTests(unittest.TestCase):
  def test_other_entries_preserved_and_install_is_idempotent(self):
    existing = 'SHELL=/bin/bash\n15 2 * * * /usr/local/bin/existing-job\n'
    prepared = cron.merge_crontab(existing)
    self.assertIn(existing, prepared)
    self.assertEqual(prepared.count(cron.BEGIN), 1)
    self.assertEqual(cron.merge_crontab(prepared), prepared)
    self.assertIn('17 4 * * *', prepared)

  def test_malformed_managed_block_refuses_install(self):
    with self.assertRaises(ValueError):
      cron.merge_crontab(cron.BEGIN + '\ninvalid\n')


if __name__ == '__main__':
  unittest.main()
