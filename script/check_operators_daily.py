#!/usr/bin/env python3
"""Check PRTS for updates without modifying game data or publishing anything."""

import argparse
from datetime import date, datetime
import fcntl
import hashlib
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import signal
import tempfile
import time

import update_operators as updater


STATE_DIR = Path('/home/andyblocker/.local/state/arknights-wordle')
STATUS_NAME = 'daily-check.json'


class CheckDeadlineExceeded(Exception):
  pass


def enforce_deadline(_signum, _frame):
  # Separate exception type avoids the updater's per-request timeout retries.
  raise CheckDeadlineExceeded('Daily check exceeded its total time limit')


def timestamp():
  return datetime.now(updater.CHINA).isoformat(timespec='seconds')


def write_status(path, value):
  encoded = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
  with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as output:
    temporary = Path(output.name)
    try:
      output.write(encoded)
      output.flush()
      os.fsync(output.fileno())
    except BaseException:
      temporary.unlink(missing_ok=True)
      raise
  temporary.chmod(0o600)
  temporary.replace(path)


def previous_status(path):
  try:
    value = json.loads(path.read_text())
    return value if isinstance(value, dict) else {}
  except (OSError, ValueError):
    return {}


def compare_source(source, as_of):
  original = source.read_bytes()
  local = json.loads(original)
  updater.validate_rows(local, as_of)
  raw, excluded = updater.fetch_rows()
  upstream, future = updater.prepare_rows(raw, as_of)
  changes = updater.summarize(local, upstream)
  # Cargo ordering is immaterial; content changes, additions and removals matter.
  changed = {row['干员']: row for row in local} != {
    row['干员']: row for row in upstream}
  return {
    'status': 'update-available' if changed else 'up-to-date',
    'needs_update': changed,
    'source': str(source),
    'source_url': 'https://prts.wiki/w/干员一览',
    'local_sha256': hashlib.sha256(original).hexdigest(),
    'upstream_sha256': hashlib.sha256(updater.json_bytes(upstream)).hexdigest(),
    'local_count': len(local),
    'upstream_count': len(upstream),
    'latest_operator_release': max(row['上线时间'] for row in upstream),
    'changes': changes,
    'excluded_nonstandard': excluded,
    'excluded_future': future,
  }


def run_check(source, state_dir, as_of, timeout_seconds=540):
  state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
  status_path = state_dir / STATUS_NAME
  with (state_dir / 'daily-check.lock').open('a+') as lock:
    try:
      fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
      return 75
    logger = logging.getLogger(f'arknights-wordle-daily-{id(lock)}')
    logger.setLevel(logging.INFO)
    logger.propagate = False
    handler = RotatingFileHandler(state_dir / 'daily-check.log',
      maxBytes=256 * 1024, backupCount=3, encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
    logger.addHandler(handler)
    previous = previous_status(status_path)
    started = time.monotonic()
    status = {
      'checked_at': timestamp(), 'as_of': as_of.isoformat(),
      'status': 'checking', 'needs_update': None,
      'last_success_at': previous.get('last_success_at'),
      'consecutive_errors': previous.get('consecutive_errors', 0),
      'source': str(source),
    }
    old_alarm = signal.signal(signal.SIGALRM, enforce_deadline)
    old_term = signal.signal(signal.SIGTERM, enforce_deadline)
    signal.alarm(timeout_seconds)
    try:
      write_status(status_path, status)
      logger.info('Checking source=%s as_of=%s', source, as_of)
      status.update(compare_source(source, as_of))
      status.update(last_success_at=timestamp(), consecutive_errors=0, error=None)
      code = 0
      logger.info('%s local=%s upstream=%s added=%s changed=%s',
        status['status'], status['local_count'], status['upstream_count'],
        len(status['changes']['added']), status['changes']['changed_existing_count'])
    except Exception as error:
      status.update(status='error', needs_update=None,
        consecutive_errors=previous.get('consecutive_errors', 0) + 1,
        error={'type': type(error).__name__, 'message': str(error)[:4000]})
      logger.exception('Daily check failed')
      code = 2
    finally:
      signal.alarm(0)
      signal.signal(signal.SIGALRM, old_alarm)
      signal.signal(signal.SIGTERM, old_term)
      status['finished_at'] = timestamp()
      status['duration_seconds'] = round(time.monotonic() - started, 3)
      try:
        write_status(status_path, status)
      finally:
        logger.removeHandler(handler)
        handler.close()
    return code


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--source', type=Path, default=updater.DEFAULT_OUTPUT)
  parser.add_argument('--state-dir', type=Path, default=STATE_DIR)
  parser.add_argument('--as-of', type=date.fromisoformat,
    default=datetime.now(updater.CHINA).date())
  parser.add_argument('--timeout-seconds', type=int, default=540)
  args = parser.parse_args()
  if not 1 <= args.timeout_seconds <= 600:
    parser.error('--timeout-seconds must be between 1 and 600')
  raise SystemExit(run_check(args.source, args.state_dir, args.as_of,
    args.timeout_seconds))


if __name__ == '__main__':
  main()
