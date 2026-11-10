#!/usr/bin/env python3
"""Install the current user's check-only daily cron, preserving other entries."""

from datetime import datetime
import json
from pathlib import Path
import subprocess

from check_operators_daily import STATE_DIR


BEGIN = '# BEGIN arknights-wordle-data-check (managed)'
END = '# END arknights-wordle-data-check (managed)'
RUNNER = Path(__file__).resolve().with_name('check_operators_daily.py')
BLOCK = f'''{BEGIN}
# Daily 04:17 server time: Asia/Singapore (UTC+08:00); check only.
17 4 * * * /usr/bin/timeout --signal=TERM --kill-after=20s 600s /usr/bin/env -i HOME=/home/andyblocker PATH=/usr/bin:/bin LANG=C.UTF-8 TZ=Asia/Singapore HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 NO_PROXY=localhost,127.0.0.1,::1 /usr/bin/python3 {RUNNER} --timeout-seconds 540 >/dev/null 2>&1
{END}'''


def merge_crontab(existing):
  if existing.count(BEGIN) != existing.count(END) or existing.count(BEGIN) > 1:
    raise ValueError('Malformed managed cron markers; refusing to replace crontab')
  if BEGIN in existing:
    start = existing.index(BEGIN)
    end = existing.index(END, start) + len(END)
    return existing[:start] + BLOCK + existing[end:]
  return (existing.rstrip('\n') + '\n\n' if existing else '') + BLOCK + '\n'


def read_crontab():
  result = subprocess.run(['crontab', '-l'], text=True, capture_output=True)
  if result.returncode == 0:
    return result.stdout, True
  if result.returncode == 1 and 'no crontab' in result.stderr:
    return '', False
  raise RuntimeError(f'Cannot read crontab: {result.stderr.strip()}')


def main():
  timezone = subprocess.check_output(['timedatectl', 'show', '-p',
    'Timezone', '--value'], text=True).strip()
  if timezone != 'Asia/Singapore':
    raise RuntimeError(f'Server timezone changed to {timezone}; review daily cron hour first')
  existing, existed = read_crontab()
  updated = merge_crontab(existing)
  STATE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
  if existing == updated:
    print('Daily cron already installed; unchanged.')
    return
  backups = STATE_DIR / 'crontab-backups'
  backups.mkdir(exist_ok=True, mode=0o700)
  backup = backups / (datetime.now().strftime('%Y%m%dT%H%M%S%f') + '.cron')
  backup.write_text(existing)
  backup.chmod(0o600)
  backup.with_suffix('.json').write_text(json.dumps({
    'previous_crontab_existed': existed, 'server_timezone': timezone,
    'backup': str(backup)}, indent=2) + '\n')
  # Detect other changes between the initial read and write.
  if read_crontab() != (existing, existed):
    raise RuntimeError('Crontab changed during installation; retry after review')
  subprocess.run(['crontab', '-'], input=updated, text=True, check=True)
  if read_crontab()[0] != updated:
    raise RuntimeError('Installed crontab does not match the prepared entry')
  print(f'Installed daily 04:17 Asia/Singapore check; prior crontab backup: {backup}')


if __name__ == '__main__':
  main()
