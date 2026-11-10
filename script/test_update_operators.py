"""Safety checks for publishing a replacement operator snapshot."""

from copy import deepcopy
from datetime import date
import json
from pathlib import Path
import unittest

import update_operators as updater


class SnapshotTests(unittest.TestCase):
  def setUp(self):
    data_dir = Path(__file__).resolve().parents[1] / 'frontend/public/data'
    self.rows = json.loads((data_dir / 'operators.json').read_text())
    metadata = json.loads((data_dir / 'operators.meta.json').read_text())
    self.as_of = date.fromisoformat(metadata['as_of'])

  def test_snapshot_has_legacy_schema_and_valid_values(self):
    updater.validate_rows(self.rows, self.as_of)

  def test_duplicate_operator_number_is_rejected(self):
    rows = deepcopy(self.rows[:2])
    rows[1]['干员序号'] = rows[0]['干员序号']
    with self.assertRaisesRegex(ValueError, 'duplicate 干员序号'):
      updater.validate_rows(rows, date(2026, 11, 10))

  def test_missing_stats_and_schema_changes_are_rejected(self):
    for key in ['满级生命', '潜能加成']:
      rows = deepcopy(self.rows[:1])
      rows[0][key] = None
      with self.assertRaises(ValueError):
        updater.validate_rows(rows, date(2026, 11, 10))
    rows = deepcopy(self.rows[:1])
    del rows[0]['皮肤1名称']
    with self.assertRaises(ValueError):
      updater.prepare_rows(rows, date(2026, 11, 10))

  def test_future_operator_is_excluded(self):
    rows = deepcopy(self.rows[:2])
    rows[1]['上线时间'] = '2026-11-11 12:00:00'
    selected, future = updater.prepare_rows(rows, date(2026, 11, 10))
    self.assertEqual([row['干员'] for row in selected], [rows[0]['干员']])
    self.assertEqual(future, [rows[1]['干员']])

  def test_existing_operator_removal_is_rejected(self):
    with self.assertRaisesRegex(ValueError, 'disappeared'):
      updater.summarize(self.rows, self.rows[1:])

  def test_legacy_html_entities_remain_compatible(self):
    self.assertEqual(updater.legacy_value("Ch'en"), 'Ch&#039;en')
    self.assertEqual(updater.legacy_value('Ch&#039;en'), 'Ch&#039;en')
    self.assertIsNone(updater.legacy_value(''))


if __name__ == '__main__':
  unittest.main()
