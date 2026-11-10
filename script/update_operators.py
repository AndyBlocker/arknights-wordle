#!/usr/bin/env python3
"""Refresh the legacy Wordle schema from PRTS Cargo without publishing it."""

import argparse
from collections import Counter
from datetime import date, datetime, time, timezone, timedelta
import hashlib
import html
import json
from pathlib import Path
import re
import tempfile
import time as clock
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / 'frontend/public/data/operators.json'
API = 'https://prts.wiki/api.php'
CHINA = timezone(timedelta(hours=8))
PAGE_SIZE = 500
TABLES = {
  'chara': {
    '干员': '_pageName', '职业': 'profession', '稀有度': 'rarity',
    '标志': 'logo', '团队': 'team', '干员外文名': 'en', '干员名jp': 'jp',
    '情报编号': 'eid', '位置': 'position', '标签': 'tag', '特性': 'feature',
    '干员序号': 'charIndex', '子职业': 'subProfession', '国家': 'nation',
    '组织': 'org',
    **{f'皮肤{i}名称': f'skin{i}name' for i in range(1, 11)},
  },
  'chara_extra_info': dict(zip(
    ['出身地', '种族', '性别', '物理强度', '战场机动', '生理耐受',
     '战术规划', '战斗技巧', '源石技艺适应性', '身高', '出生日期', '感染状态'],
    ['birthPlace', 'race', 'sex', 'phy', 'flex', 'tolerance', 'plan',
     'skill', 'adapt', 'height', 'dateOfBirth', 'infectionStatus'])),
  'char_obtain': {'获得方式': 'obtainMethod', '上线时间': 'cnOnlineTime'},
  'chara_data': dict(zip(
    ['满级生命', '满级攻击', '满级防御', '满级法术抗性', '再部署时间',
     '部署费用', '阻挡数', '攻击速度', '潜能加成', '信赖加成'],
    ['hp', 'atk', 'def', 'res', 'reDeploy', 'cost', 'block', 'atkSpeed',
     'potential', 'trust'])),
}
FIELDS = [key for mapping in TABLES.values() for key in mapping] + ['上线时间__precision']


def api_get(params):
  url = API + '?' + urllib.parse.urlencode({'format': 'json', **params})
  for attempt in range(3):
    try:
      request = urllib.request.Request(url, headers={
        'User-Agent': 'ArknightsWordleDataUpdater/1.0 (https://mer.dev/arknights-wordle/)',
        'Accept': 'application/json',
      })
      with urllib.request.urlopen(request, timeout=60) as response:
        result = json.load(response)
      if 'error' in result or 'warnings' in result:
        raise ValueError(f'PRTS API returned an error/warning: {result}')
      return result
    except (OSError, ValueError):
      if attempt == 2:
        raise
      clock.sleep(1 + attempt)


def cargo_pages(params):
  rows = []
  for offset in range(0, 10000, PAGE_SIZE):
    result = api_get({'action': 'cargoquery', 'limit': PAGE_SIZE,
                      'offset': offset, **params})
    page = result.get('cargoquery')
    if not isinstance(page, list):
      raise ValueError('Missing cargoquery result')
    rows.extend(item['title'] for item in page)
    if len(page) < PAGE_SIZE:
      return rows
  raise ValueError('Unexpected Cargo result size; refusing a truncated update')


def category_members():
  names, continuation = set(), {}
  for _ in range(20):
    result = api_get({'action': 'query', 'list': 'categorymembers',
      'cmtitle': '分类:干员', 'cmtype': 'page', 'cmlimit': PAGE_SIZE,
      **continuation})
    names.update(row['title'] for row in result['query']['categorymembers'])
    continuation = result.get('continue')
    if not continuation:
      return names
  raise ValueError('Unexpected category size; refusing a truncated update')


def fetch_rows():
  category = category_members()
  # Positive indices and category membership also select some event NPCs.
  catalog = cargo_pages({'tables': 'chara',
    'fields': '_pageName=name,charIndex=number', 'where': 'charIndex>0',
    'order_by': '_pageName'})
  expected = {row['name'] for row in catalog if row['name'] in category}
  if len(expected) < 300:
    raise ValueError('Implausibly small operator catalog')
  aliases = {table: f't{i}' for i, table in enumerate(TABLES)}
  rows = cargo_pages({
    'tables': ','.join(f'{table}={alias}' for table, alias in aliases.items()),
    'fields': ','.join(f'{aliases[table]}.{column}={label}'
      for table, mapping in TABLES.items() for label, column in mapping.items()),
    'join_on': ','.join(f't0._pageName={alias}._pageName'
      for table, alias in aliases.items() if table != 'chara'),
    'where': 't0.charIndex>0', 'order_by': 't0._pageName',
  })
  selected = [row for row in rows if row['干员'] in expected]
  missing = expected - {row['干员'] for row in selected}
  if missing:
    raise ValueError(f'Cargo joins dropped operators: {sorted(missing)}')
  nonstandard = {row['干员'] for row in selected if row['获得方式'] == '无'}
  selected = [row for row in selected if row['干员'] not in nonstandard]
  excluded = nonstandard | {row['name'] for row in catalog if row['name'] not in category}
  return selected, sorted(excluded)


def legacy_value(value):
  if value in ('', None):
    return None
  # Preserve the previous Cargo export's HTML-escaped strings and nulls.
  return html.escape(html.unescape(str(value)), quote=True).replace('&#x27;', '&#039;')


def prepare_rows(rows, as_of):
  cutoff = datetime.combine(as_of, time.max, tzinfo=CHINA)
  result, future = [], []
  for raw in rows:
    if set(raw) != set(FIELDS):
      raise ValueError(f'Unexpected schema for {raw.get("干员")}: {sorted(set(raw) ^ set(FIELDS))}')
    row = {key: legacy_value(raw[key]) for key in FIELDS}
    if not row['上线时间']:
      raise ValueError(f'Missing release date: {row["干员"]}')
    release = datetime.strptime(row['上线时间'], '%Y-%m-%d %H:%M:%S').replace(tzinfo=CHINA)
    if release > cutoff:
      future.append(row['干员'])
    else:
      result.append(row)
  validate_rows(result, as_of)
  return result, future


def validate_rows(rows, as_of):
  if not isinstance(rows, list) or not rows:
    raise ValueError('Expected a nonempty operator array')
  for key in ['干员', '干员序号']:
    values = [row.get(key) for row in rows]
    if None in values or len(set(values)) != len(values):
      raise ValueError(f'Missing/duplicate {key}')
  for row in rows:
    name = row['干员']
    if set(row) != set(FIELDS) or any(value is not None and not isinstance(value, str) for value in row.values()):
      raise ValueError(f'Legacy schema/type mismatch: {name}')
    if row['稀有度'] not in [str(i) for i in range(6)] or row['职业'] not in ['先锋', '近卫', '重装', '狙击', '术师', '医疗', '辅助', '特种']:
      raise ValueError(f'Invalid rarity/profession: {name}')
    for key in ['满级生命', '满级攻击', '满级防御', '满级法术抗性']:
      if not row[key] or not re.fullmatch(r'\d+', row[key]):
        raise ValueError(f'Missing/invalid {key}: {name}')
    for key in ['位置', '子职业', '获得方式', '再部署时间', '部署费用', '阻挡数', '攻击速度', '潜能加成', '信赖加成']:
      if not row[key]:
        raise ValueError(f'Missing {key}: {name}')
    if not re.fullmatch(r'\d+,\d+,\d+', row['信赖加成']):
      raise ValueError(f'Invalid trust format: {name}')
    if row['潜能加成'].count('`') != 1:
      raise ValueError(f'Invalid potential format: {name}')
    keys, values = row['潜能加成'].split('`')
    if len(keys.split(',')) != len(values.split(',')):
      raise ValueError(f'Unpaired potential fields: {name}')
    if datetime.strptime(row['上线时间'], '%Y-%m-%d %H:%M:%S').date() > as_of:
      raise ValueError(f'Future operator: {name}')


def summarize(old, new):
  previous = {row['干员']: row for row in old}
  current = {row['干员']: row for row in new}
  removed = sorted(previous.keys() - current.keys())
  if removed:
    raise ValueError(f'Existing operators disappeared; manual review required: {removed}')
  fields = Counter()
  changed = []
  for name in previous.keys() & current.keys():
    differences = [key for key in FIELDS if previous[name].get(key) != current[name][key]]
    fields.update(differences)
    if differences:
      changed.append(name)
  return {'previous_count': len(old), 'operator_count': len(new),
    'added': sorted(current.keys() - previous.keys()), 'removed': removed,
    'changed_existing_count': len(changed), 'changed_fields': dict(sorted(fields.items()))}


def json_bytes(value):
  return (json.dumps(value, ensure_ascii=False, indent=4) + '\n').encode('utf-8')


def atomic_write(path, data):
  path.parent.mkdir(parents=True, exist_ok=True)
  with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
    temporary.write(data)
    temp_path = Path(temporary.name)
  temp_path.chmod(0o644)
  temp_path.replace(path)


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--as-of', type=date.fromisoformat, default=datetime.now(CHINA).date())
  parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
  parser.add_argument('--check', action='store_true', help='Fetch and compare; do not write; exit 1 if changed')
  parser.add_argument('--validate-only', action='store_true', help='Validate the local snapshot without network requests')
  args = parser.parse_args()
  old = json.loads(args.output.read_text()) if args.output.exists() else []
  if args.validate_only:
    validate_rows(old, args.as_of)
    print(f'Validated {len(old)} operators / {len(FIELDS)} fields')
    return
  raw, excluded = fetch_rows()
  rows, future = prepare_rows(raw, args.as_of)
  summary = summarize(old, rows)
  data = json_bytes(rows)
  metadata = {'source': 'PRTS Wiki', 'source_url': 'https://prts.wiki/w/干员一览',
    'api_url': API, 'tables': list(TABLES),
    'license_url': 'https://prts.wiki/w/PRTS:著作权',
    'fetched_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
    'as_of': args.as_of.isoformat(), 'timezone': 'Asia/Shanghai',
    'latest_operator_release': max(row['上线时间'] for row in rows),
    'operator_count': len(rows), 'field_count': len(FIELDS),
    'sha256': hashlib.sha256(data).hexdigest(),
    'selection': '分类:干员 membership, charIndex > 0, obtainMethod != 无, complete Cargo join, released by as_of',
    'excluded_nonstandard': excluded, 'excluded_future': future,
    'null_counts': {key: sum(row[key] is None for row in rows) for key in FIELDS if any(row[key] is None for row in rows)},
    'changes': summary}
  print(json.dumps(metadata, ensure_ascii=False, indent=2))
  if args.check:
    raise SystemExit(0 if old == rows else 1)
  atomic_write(args.output, data)
  atomic_write(args.output.with_name(args.output.stem + '.meta.json'), json_bytes(metadata))


if __name__ == '__main__':
  main()
