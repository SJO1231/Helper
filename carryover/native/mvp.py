"""Small SQLite owner for the manual G2B Helper MVP. No legacy Store is opened."""
import copy
import html
import json
import sqlite3
import threading
import re
from datetime import datetime, timezone
from urllib.parse import urlparse
from .model import Fault, require, dumps, loads, digest, empty
from .dictionary_seed import DEFAULTS
from .documents import COMMANDS as DOCUMENT_COMMANDS, forward as document_forward

IDENTITIES = {'receipt': ['ctrtDmndRcptNo', 'ctrtDmndRcptOrd'], 'bid': ['bidPbancNo', 'bidPbancOrd'], 'contract': ['ctrtNo', 'ctrtChgOrd']}
SCREENS = {'receipt': ('01001', {'01114', '01117'}), 'bid': ('01173', {'01174'}), 'contract': ('01570', {'01571'})}
WRITE = {'mvp.apply', 'mvp.edit', 'mvp.trash', 'mvp.restore', 'mvp.settings.save', 'mvp.reset', 'mvp.columns.remove'}
CONTRACT_USER_DEFAULTS = {'종결': False, '지정일': '', '종결금액': '', '선금보증기한': '', '선금보증금액': ''}
DERIVED_USER_FIELDS = {'지체일수', '미종결금액'}

def identity_text(value):
    if isinstance(value, bool):
        return 'true' if value else 'false'
    return str(value) if isinstance(value, (str, int)) else None

def belongs_to(row, stage, identity):
    return all(k not in row or absent(row[k]) or identity_text(row[k]) == value for k, value in zip(IDENTITIES[stage], identity))

def default_user_values(stage):
    return copy.deepcopy(CONTRACT_USER_DEFAULTS) if stage == 'contract' else {}

def valid_user_column_keys(keys):
    return isinstance(keys, list) and len(keys) <= 500 and all(isinstance(key, str) and key.strip() for key in keys) and len(set(keys)) == len(keys)

def valid_document_links(links):
    """Per stage and template profile: template field name -> Helper source key (#21)."""
    text = lambda value: isinstance(value, str) and 0 < len(value) <= 200
    return isinstance(links, dict) and all(
        stage in IDENTITIES and isinstance(profiles, dict) and all(
            text(profile) and isinstance(fields, dict) and len(fields) <= 2000 and all(text(name) and text(source) for name, source in fields.items())
            for profile, fields in profiles.items())
        for stage, profiles in links.items())

def default_settings():
    return {'theme': 'light', 'extractionMode': 'tables', 'hideEmptyColumns': True, 'hideUnmappedColumns': False, 'hideEmptyTables': False,
            'dictionary': {'keys': {**DEFAULTS['KEY_LABELS'], **EXTRA_LABELS}, 'values': DEFAULTS['CODE_SEED']}, 'launchers': [],
            'shortcuts': {'collect': 'Alt+Shift+S', 'document': 'Alt+Shift+D'}, 'columnTypes': {}, 'userColumns': {}}

def same(left, right):
    return dumps(left) == dumps(right)  # SQLite/Python bool != integer zero.

def absent(value):
    return empty(value) or value == [] or value == {}

def record_id(observation):
    return observation['stage'] + ':' + digest(observation['identity'])[:32]

def valid_screen_rules(rules):
    return (isinstance(rules, list) and len(rules) <= 500 and all(
        isinstance(rule, dict) and rule.get('stage') in IDENTITIES
        and all(isinstance(rule.get(key), str) and rule[key].strip() for key in ('id', 'urlPattern', 'areaCd', 'depth1', 'depth2'))
        and ('depth3' not in rule or isinstance(rule['depth3'], str)) for rule in rules)
        and len({rule['id'] for rule in rules}) == len(rules))


def screen_rule_matches(rule, source):
    pattern = rule['urlPattern']
    url_matches = (re.fullmatch('.*'.join(re.escape(part) for part in pattern.split('*')), source['url'], re.DOTALL) is not None
                   if '*' in pattern else source['url'].startswith(pattern))
    return (url_matches and all(source.get(key) == rule[key] for key in ('areaCd', 'depth1', 'depth2'))
            and (not rule.get('depth3', '').strip() or source.get('depth3') == rule['depth3']))


def validate_observation(observation, screen_rules=None):
    require(isinstance(observation, dict), '수집 자료가 객체여야 합니다.')
    stage = observation.get('stage')
    require(stage in IDENTITIES, '지원하지 않는 업무입니다.')
    identity = observation.get('identity')
    require(isinstance(identity, list) and len(identity) == 2 and all(isinstance(s, str) and s.strip() for s in identity), '업무번호와 차수가 필요합니다.')
    fields = observation.get('fields')
    require(isinstance(fields, dict) and all(isinstance(k, str) for k in fields), '원천 열을 확인하세요.')
    require(all(identity_text(fields.get(k)) == v for k, v in zip(IDENTITIES[stage], identity)), '업무키와 원천 필드가 다릅니다.')
    source = observation.get('source', {})
    require(isinstance(source, dict) and isinstance(source.get('url'), str), '프레임 출처 형식을 확인하세요.', 'SCREEN')
    locator = urlparse(source['url']); host = locator.hostname or ''
    depth1, depth2 = SCREENS[stage]
    require(locator.scheme in ('http', 'https') and (host == 'g2b.go.kr' or host.endswith('.g2b.go.kr')), '등록된 나라장터 URL에서만 수집합니다.', 'SCREEN')
    if screen_rules is None:
        require(source.get('areaCd') == '14' and source.get('depth1') == depth1 and source.get('depth2') in depth2, '등록된 화면 코드에서만 수집합니다.', 'SCREEN')
        if source.get('depth3') and stage in ('bid', 'contract'):
            # Notice/contract management lists (01175/01572) are excluded by default (#17); saved screen rules can add them.
            require(source['depth3'] in ({'01179'} if stage == 'bid' else {'01579'}), '등록되지 않은 하위 화면입니다.', 'SCREEN')
    else:
        matches = {rule['stage'] for rule in screen_rules if screen_rule_matches(rule, source)}
        require(matches == {stage}, '등록된 수집 화면 규칙이 일치하지 않거나 업무가 모호합니다.', 'SCREEN')
    require(isinstance(source.get('framePath'), str), '프레임 출처가 필요합니다.')
    raw = observation.get('rawJson')
    require(isinstance(raw, str) and len(raw.encode('utf-8')) <= 48 * 1024 * 1024, '원본 JSON 크기/형식을 확인하세요.')
    try:
        origin = loads(raw)
    except (ValueError, TypeError):
        raise Fault('VALIDATION', '원본 JSON을 읽을 수 없습니다.')
    require(isinstance(origin, dict), '원본 JSON이 객체여야 합니다.')
    point = origin.get('pointInfo', {})
    require(isinstance(point, dict) and all(point.get(k) == source.get(k) for k in ['areaCd', 'depth1', 'depth2']), '원본과 화면 조건이 다릅니다.', 'SCREEN')
    require(not source.get('depth3') or point.get('depth3') == source['depth3'], '원본 하위 화면 코드가 다릅니다.', 'SCREEN')
    require('url' not in origin or origin['url'] == source['url'], '원본 프레임 URL이 다릅니다.', 'SCREEN')
    require('framePath' not in origin or origin['framePath'] == source['framePath'], '원본 프레임 경로가 다릅니다.', 'SCREEN')
    require(not origin.get('warnings'), '읽기 오류가 있는 원본은 수집하지 않습니다.', 'SCREEN')
    tables = origin.get('tables')
    require(isinstance(tables, dict) and all(isinstance(k, str) and isinstance(rows, list) and all(isinstance(row, dict) for row in rows) for k, rows in tables.items()), '원본 표 형식을 확인하세요.')
    source_rows = [point, *(row for rows in tables.values() for row in rows)]
    relevant = [row for row in source_rows if belongs_to(row, stage, identity)]
    require(any(all(k in row and identity_text(row[k]) == value for k, value in zip(IDENTITIES[stage], identity)) for row in relevant), '원본에 완전한 업무키가 없습니다.')
    require(all(any(field in row and same(row[field], value) for row in relevant) for field, value in fields.items()), '원천 열/값이 해당 업무의 원본 JSON과 다릅니다.')
    children = observation.get('children')
    require(isinstance(children, list) and len(children) <= 500, '하위 표 형식을 확인하세요.')
    seen = set()
    for child in children:
        require(isinstance(child, dict) and isinstance(child.get('key'), str) and child['key'] not in seen, '하위 표 키가 중복되었습니다.')
        seen.add(child['key'])
        require(child.get('kind') in ('items', 'qualification', 'other') and isinstance(child.get('label'), str), '하위 표 분류를 확인하세요.')
        require(isinstance(child.get('rows'), list) and all(isinstance(row, dict) for row in child['rows']), '하위 표 행을 확인하세요.')
        require(child['key'] in tables and all(belongs_to(row, stage, identity) and any(same(row, source_row) for source_row in tables[child['key']]) for row in child['rows']), '하위 표가 해당 업무의 원본 JSON과 다릅니다.')
    require(isinstance(observation.get('capturedAt'), str), '수집 시각이 필요합니다.')
    return observation

BREAK = re.compile(r'<br\b[^>]*>', re.IGNORECASE)
# Only complete entities ending in ';': a bare '&' in source text such as 'Q&notes' stays as it is.
ENTITY = re.compile(r'&(?:#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);')

def decoded(value):
    """
    Source text is stored with HTML entities decoded and <br/> as a line break (user, 2026-10-09, decision 2 g, A안, #71).
    The raw JSON keeps the original; it is validated before decoding, so source checks compare like with like.
    """
    if isinstance(value, str):
        return BREAK.sub('\n', ENTITY.sub(lambda match: html.unescape(match.group()), value)) if '&' in value or '<' in value else value
    if isinstance(value, list):
        return [decoded(item) for item in value]
    if isinstance(value, dict):
        return {key: decoded(item) for key, item in value.items()}
    return value

def merge_fields(previous, incoming, rid, changes):
    """
    The screen's source values are applied (user, 2026-10-09, #43, replacing the field choice of M05). An empty screen
    value never erases a stored one. A stored value replaced by a different one is listed for the notice.
    """
    merged = copy.deepcopy(previous)
    for field, value in incoming.items():
        if absent(value):
            if field not in merged:
                merged[field] = copy.deepcopy(value)
            continue
        if field in merged and not absent(merged[field]) and not same(merged[field], value):
            changes.append({'recordId': rid, 'field': field, 'previous': copy.deepcopy(merged[field]), 'incoming': copy.deepcopy(value)})
        merged[field] = copy.deepcopy(value)
    return merged

def merge_children(previous, incoming, rid, changes):
    """
    A child table that differs is replaced as a whole by the screen's table (user, 2026-10-09, #43). An empty screen
    table keeps the stored rows: a tab that was not opened can look empty. Tables the screen did not send stay.
    """
    merged = copy.deepcopy(previous)
    for child in incoming:
        index = next((position for position, stored in enumerate(merged) if stored['key'] == child['key']), None)
        if index is None:
            merged.append(copy.deepcopy(child)); continue
        if not child['rows'] or same(merged[index]['rows'], child['rows']):
            continue
        if merged[index]['rows']:
            changes.append({'recordId': rid, 'field': dumps(['children', child['key']]), 'previous': len(merged[index]['rows']), 'incoming': len(child['rows'])})
        merged[index] = copy.deepcopy(child)
    return merged

# The representative item and total columns of #30 were withdrawn (user, 2026-10-09, #41); their stored values are removed once.
WITHDRAWN_SUMMARY_COLUMNS = ('대표 품명', '대표 단위', '합계 수량', '합계 금액', '품목 수')
WITHDRAWN_SUMMARY_TYPES = {'합계 금액': 'money', '합계 수량': 'number'}
SCHEMA_VERSIONS = {'g2b': 1, 'settings': 1}  # module structure versions kept in schema_versions (#90 decision 6)
RECORD_KEYS = {'recordId', 'stage', 'identity', 'fields', 'children', 'rawJson', 'source', 'capturedAt', 'storeVersion', 'userValues', 'deletedAt'}
PERSONAL_SETTINGS = ('theme', 'launchers', 'shortcuts', 'documentProfiles', 'documentLinks')  # #90 answer 1: 런처·단축키·테마·문서 연결
MAX_COLUMNS = 1900  # SQLite allows 2,000 columns per DB table
SCHEMA_VERSION = 4  # legacy one-JSON DB (before #90): PRAGMA user_version: 1 = summary columns removed (#41), 2 = corrections and locks removed (#42), 3 = child tables named (#44), 4 = lcnsLmtYn label (#45)
# Value meanings confirmed by the user as label units (2026-10-09, decision 2 x, #77); keys that already had a label keep it.
UNIT_LABELS = {'lqdmRat': '지체상금률(일당 %)', 'advfPinfrmPsbltyRat': '선고지(가능) 비율(%)', 'advcPinfrmPsbltyRat': '선고지(가능) 비율(%)', 'ctrtSharRat': '지분율(%)'}
EXTRA_LABELS = {'lcnsLmtYn': '업종제한 여부', **UNIT_LABELS}  # labelled for output instead of a new column (user, 2026-10-09, #45, #77)

# Child tables get names instead of screen IDs (user, 2026-10-09, #44): items are '물품', these by the last part of the
# screen ID, any other table by that last part. Attachment tables are dropped (the raw JSON keeps them), and so is every
# bid contact table after the first (the second is always empty).
# Item table tails per stage, the plain table before its Excel copy (apps/mvp/extractor.ts tableKind).
ITEM_TABLES = {'receipt': ('gvDmndItem', 'gridView', 'gridViewExcel'), 'bid': ('grdAliasDmTtl01List',), 'contract': ('grdCtrtLis', 'grdCtrtLisExcel')}
CHILD_NAMES = {'receipt': {'gvCtrtDmndDmstPic': '수요기관', 'gvOderPlan': '발주계획'},
               'bid': {'grdAliasDmTtl06List': '수요기관', 'grdAliasDmTtl07LeftList': '자격제한'},
               'contract': {'grdEtpsLst': '업체'}}

def named_children(stage, children):
    named, used, contacts = [], set(), 0
    for child in children:
        last = child['key'].rsplit('_', 1)[-1]
        if last == 'grdFile':
            continue
        if stage == 'bid' and last == 'grdAliasDmTtl06List':
            contacts += 1
            if contacts > 1:
                continue
        name = '물품' if child['kind'] == 'items' else CHILD_NAMES[stage].get(last, last)
        unique, number = name, 2
        while unique in used:
            unique, number = f'{name} {number}', number + 1
        used.add(unique)
        # The collection code stays with the table: DB columns use it, the screen shows the name (#90 answer 4).
        named.append({**child, 'key': unique, 'label': unique, 'code': child.get('code', child['key'])})
    return named

def legacy_code(record, child):
    """The collection code of a table stored before codes were kept: the raw table holding its rows, else its name (#90)."""
    try:
        tables = loads(record.get('rawJson') or '{}').get('tables', {})
    except (ValueError, AttributeError):
        tables = {}
    if not isinstance(tables, dict):
        return child['key']
    # A recollection with an empty tab kept the stored rows under a newer raw JSON, so the screen-ID tail decides first.
    wanted = ITEM_TABLES[record['stage']] if child['kind'] == 'items' else (({name: last for last, name in CHILD_NAMES[record['stage']].items()}.get(child['key'], child['key'])),)
    named = sorted((key for key in tables if key.rsplit('_', 1)[-1] in wanted), key=lambda key: (wanted.index(key.rsplit('_', 1)[-1]), key))
    matches = [key for key, rows in tables.items() if isinstance(rows, list) and all(any(same(row, source) for source in rows) for row in child['rows'])]
    preferred = named or (matches if child['rows'] else [])
    return preferred[0] if preferred else child['key']

def quote(name):
    return '"' + name.replace('"', '""') + '"'

def public(record):
    """A record as the screen and documents get it: the tables' collection codes stay in the DB (#90)."""
    return {**record, 'children': [{key: value for key, value in child.items() if key != 'code'} for child in record['children']]}

# Contact columns from the first row of the 수요기관 table, under their own keys, when the main values lack them (#45).
CONTACT_KEYS = {'bid': ('deptNm', 'picNm', 'tlphNo', 'eml', 'dmstPicId'), 'receipt': ('deptNm', 'eml', 'dmstPicId'), 'contract': ()}

def computed_values(record):
    """Helper columns made when read and never stored (user, 2026-10-09, #45)."""
    tables, values = {child['key']: child['rows'] for child in record['children']}, {}
    text = lambda value: '' if absent(value) else str(value)
    groups = {}
    for row in tables.get('자격제한', []) if record['stage'] == 'bid' else []:
        name, code = text(row.get('bidLmtUntyNm')), text(row.get('bidLmtUntyCd'))
        if name or code:
            groups.setdefault(text(row.get('lmtGupSqno')), []).append(name + ('(' + code + ')' if code else ''))
    if groups:
        values['업종제한'] = ' 또는 '.join('[' + '와 '.join(items) + '] 업종' for items in groups.values())  # user's example: [업종B(코드)와 업종C(코드)] 업종
    first = (tables.get('수요기관') or [{}])[0]
    for key in CONTACT_KEYS[record['stage']]:
        if key not in record['fields'] and not absent(first.get(key)):
            values[key] = first[key]
    return values

def order_key(order):
    """Business order numbers compare as numbers when they are ASCII digits ('9' < '10'); other orders follow as text."""
    return (0, int(order), order) if re.fullmatch(r'[0-9]+', order) else (1, 0, order)

def carried_user_values(stage, earlier):
    """Every user column value of the previous order (user, 2026-10-08, #34). Defaults alone are not announced."""
    values, defaults = copy.deepcopy(earlier['userValues']), default_user_values(stage)
    meaningful = any(not absent(value) and not (key in defaults and same(value, defaults[key])) for key, value in values.items())
    return values, meaningful

class MvpGateway:
    def __init__(self, filename):
        from pathlib import Path
        Path(filename).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(filename, isolation_level=None, check_same_thread=False)
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.execute('PRAGMA busy_timeout=5000')
        self.db.execute('PRAGMA journal_mode=WAL')
        self.lock = threading.RLock()
        self.columns = {}
        legacy = self.db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='mvp_records'").fetchone()
        self.create_tables()
        if legacy:
            if 'deleted_at' not in {row[1] for row in self.db.execute('PRAGMA table_info(mvp_records)')}:
                self.db.execute('ALTER TABLE mvp_records ADD COLUMN deleted_at TEXT')
            self.db.execute('CREATE TABLE IF NOT EXISTS mvp_settings (singleton INTEGER PRIMARY KEY CHECK(singleton=1), store_version INTEGER NOT NULL, payload TEXT NOT NULL)')
            self.db.execute('INSERT OR IGNORE INTO mvp_settings VALUES(1,1,?)', (dumps(default_settings()),))
            self.migrate()
            self.convert_legacy()
        # A missing settings row (new DB, or a DB table deleted to recover) starts from the defaults.
        defaults = default_settings()
        self.db.execute('INSERT OR IGNORE INTO settings_shared VALUES(1,1,?)', (dumps({k: v for k, v in defaults.items() if k not in PERSONAL_SETTINGS}),))
        self.db.execute('INSERT OR IGNORE INTO settings_personal VALUES(1,(SELECT store_version FROM settings_shared),?)', (dumps({k: v for k, v in defaults.items() if k in PERSONAL_SETTINGS}),))
        self.db.executemany('INSERT OR IGNORE INTO schema_versions VALUES(?,?)', SCHEMA_VERSIONS.items())
        if self.db.execute("SELECT version FROM schema_versions WHERE module='settings'").fetchone()[0] < 2:
            # settings 2: the unit labels of #77 join the key dictionary once, where the user has no label for the key.
            settings = self.read_settings()[1]; keys = settings.setdefault('dictionary', {}).setdefault('keys', {})
            if any(key not in keys for key in UNIT_LABELS):
                settings['dictionary']['keys'] = {**UNIT_LABELS, **keys}; self.write_settings(settings)
            self.db.execute("UPDATE schema_versions SET version=2 WHERE module='settings'")

    def migrate(self):
        """One-time changes to stored data, tracked by PRAGMA user_version so a later column of the same name is kept."""
        if self.db.execute('PRAGMA user_version').fetchone()[0] >= SCHEMA_VERSION:
            return
        self.db.execute('BEGIN IMMEDIATE')
        try:
            version = self.db.execute('PRAGMA user_version').fetchone()[0]
            if version < 1:
                self.drop_summary_columns()
            if version < 2:
                self.drop_corrections_and_locks()
            if version < 3:
                self.name_child_tables()
            if version < 4:
                settings = loads(self.db.execute('SELECT payload FROM mvp_settings WHERE singleton=1').fetchone()[0])
                keys = settings.setdefault('dictionary', {}).setdefault('keys', {})
                if any(key not in keys for key in EXTRA_LABELS):
                    settings['dictionary']['keys'] = {**EXTRA_LABELS, **keys}
                    self.db.execute('UPDATE mvp_settings SET store_version=store_version+1,payload=? WHERE singleton=1', (dumps(settings),))
            self.db.execute('PRAGMA user_version=%d' % SCHEMA_VERSION)
            self.db.execute('COMMIT')
        except Exception:
            self.db.execute('ROLLBACK'); raise

    def drop_summary_columns(self):
        """Remove the withdrawn summary columns' values, their automatic copies, column definitions and default types (#41)."""
        names = WITHDRAWN_SUMMARY_COLUMNS
        query = ("SELECT payload FROM mvp_records WHERE json_type(payload, '$.summaryValues') IS NOT NULL OR EXISTS "
                 "(SELECT 1 FROM json_each(payload, '$.userValues') WHERE key IN (%s))" % ','.join('?' * len(names)))
        for (payload,) in self.db.execute(query, names).fetchall():
            record = loads(payload)
            record.pop('summaryValues', None)
            record['userValues'] = {key: value for key, value in record['userValues'].items() if key not in names}
            self.save_v4({**record, 'storeVersion': record['storeVersion'] + 1})
        settings = loads(self.db.execute('SELECT payload FROM mvp_settings WHERE singleton=1').fetchone()[0])
        changed = copy.deepcopy(settings)
        changed['userColumns'] = {stage: [key for key in keys if key not in names] for stage, keys in settings.get('userColumns', {}).items()}
        changed['columnTypes'] = {key: kind for key, kind in settings.get('columnTypes', {}).items() if WITHDRAWN_SUMMARY_TYPES.get(key) != kind}
        if 'userColumns' not in settings: changed.pop('userColumns')
        if 'columnTypes' not in settings: changed.pop('columnTypes')
        if not same(changed, settings):
            self.db.execute('UPDATE mvp_settings SET store_version=store_version+1,payload=? WHERE singleton=1', (dumps(changed),))

    def close(self):
        self.db.close()

    def save_v4(self, record):
        """Legacy one-JSON save, used only by the migrations that run before convert_legacy."""
        self.db.execute('INSERT INTO mvp_records(record_id,stage,store_version,payload,deleted_at) VALUES(?,?,?,?,?) ON CONFLICT(record_id) DO UPDATE SET store_version=excluded.store_version,payload=excluded.payload,deleted_at=excluded.deleted_at',
                        (record['recordId'], record['stage'], record['storeVersion'], dumps(record), record.get('deletedAt')))

    # --- DB tables (user, 2026-10-13, decision 3 and the #90 answers) ---------------------------------------------------
    # Per stage: g2b_<stage> (main: one row per record, a column per source key), g2b_<stage>_items (one row per item
    # line, a column per item key) and g2b_<stage>_etc (one row per record, a column per other table's collection code,
    # plus the raw JSON). Values are the original value as JSON text. Fixed columns start with '_'; a key that cannot be a
    # column (empty, starting with '_', differing from a column only by case, or past the column limit) is kept in _extra.

    def create_tables(self):
        script = [
            'CREATE TABLE IF NOT EXISTS mvp_requests (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, response TEXT NOT NULL);',
            'CREATE TABLE IF NOT EXISTS settings_shared (singleton INTEGER PRIMARY KEY CHECK(singleton=1), store_version INTEGER NOT NULL, payload TEXT NOT NULL);',
            'CREATE TABLE IF NOT EXISTS settings_personal (singleton INTEGER PRIMARY KEY CHECK(singleton=1), store_version INTEGER NOT NULL, payload TEXT NOT NULL);',
            'CREATE TABLE IF NOT EXISTS scratch (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL);',
            'CREATE TABLE IF NOT EXISTS schema_versions (module TEXT PRIMARY KEY, version INTEGER NOT NULL);',
        ]
        for stage in IDENTITIES:
            keys = ''.join(f', _key{index} TEXT' for index in range(1, len(IDENTITIES[stage]) + 1))
            script += [
                f'CREATE TABLE IF NOT EXISTS g2b_{stage} (_record_id TEXT PRIMARY KEY{keys}, _store_version INTEGER NOT NULL, _captured_at TEXT, _deleted_at TEXT, _source TEXT, _user_values TEXT NOT NULL, _extra TEXT);',
                f'CREATE TABLE IF NOT EXISTS g2b_{stage}_items (_record_id TEXT NOT NULL, _child INTEGER NOT NULL, _line INTEGER NOT NULL, _table TEXT NOT NULL, _extra TEXT, PRIMARY KEY(_record_id, _child, _line));',
                f'CREATE TABLE IF NOT EXISTS g2b_{stage}_etc (_record_id TEXT PRIMARY KEY, _raw_json TEXT, _children TEXT NOT NULL);',
            ]
        for statement in script:  # not executescript: it commits an open transaction (mvp.reset runs inside one, #125)
            self.db.execute(statement)

    def table_columns(self, table):
        if table not in self.columns:
            self.columns[table] = {row[1].lower(): row[1] for row in self.db.execute(f'PRAGMA table_info({quote(table)})')}
        return self.columns[table]

    def column(self, table, key):
        """The column holding a key, added when new; None when the key goes to _extra."""
        columns = self.table_columns(table)
        if not key or key.startswith('_') or '\x00' in key:
            return None
        if key.lower() not in columns:  # another host process may have added it since the cache was read
            self.columns.pop(table, None); columns = self.table_columns(table)
        if key.lower() in columns:
            return key if columns[key.lower()] == key else None
        if len(columns) >= MAX_COLUMNS:
            return None
        self.db.execute(f'ALTER TABLE {quote(table)} ADD COLUMN {quote(key)} TEXT')
        columns[key.lower()] = key
        return key

    def write_row(self, table, values):
        names = list(values)
        self.db.execute(f'INSERT INTO {quote(table)} ({",".join(map(quote, names))}) VALUES ({",".join("?" * len(names))})', [values[name] for name in names])

    def keyed(self, table, row, values, extra):
        """Puts each key of row in its column, or in extra."""
        for key, value in row.items():
            column = self.column(table, key)
            if column is None:
                extra[key] = value
            else:
                values[column] = dumps(value)

    def save(self, record):
        stage, rid = record['stage'], record['recordId']
        main, items, etc = f'g2b_{stage}', f'g2b_{stage}_items', f'g2b_{stage}_etc'
        for table in (main, items, etc):
            self.db.execute(f'DELETE FROM {quote(table)} WHERE _record_id=?', (rid,))
        columns = self.table_columns(main)
        for index in range(1, len(record['identity']) + 1):  # 업무키 칸 수만 늘릴 수 있게 (#90 decision 7)
            if f'_key{index}' not in columns:
                self.db.execute(f'ALTER TABLE {quote(main)} ADD COLUMN _key{index} TEXT'); columns[f'_key{index}'] = f'_key{index}'
        values = {'_record_id': rid, '_store_version': record['storeVersion'], '_captured_at': record.get('capturedAt'), '_deleted_at': record.get('deletedAt'),
                  '_source': dumps(record['source']) if 'source' in record else None, '_user_values': dumps(record['userValues'])}
        values.update({f'_key{index}': part for index, part in enumerate(record['identity'], 1)})
        overflow = {}
        self.keyed(main, record['fields'], values, overflow)
        others = {key: value for key, value in record.items() if key not in RECORD_KEYS}
        extra = {**({'fields': overflow} if overflow else {}), **({'record': others} if others else {})}
        values['_extra'] = dumps(extra) if extra else None
        self.write_row(main, values)
        meta, tables = [], {'_record_id': rid, '_raw_json': record.get('rawJson')}
        for position, child in enumerate(record['children']):
            entry = {key: value for key, value in child.items() if key != 'rows'}  # a child's own keys never start with '_'
            code = child.get('code', child['key'])
            if child['kind'] == 'items':
                entry['_items'] = True
                for line, row in enumerate(child['rows']):
                    cells, spill = {'_record_id': rid, '_child': position, '_line': line, '_table': code}, {}
                    self.keyed(items, row, cells, spill)
                    cells['_extra'] = dumps(spill) if spill else None
                    self.write_row(items, cells)
            else:
                column = self.column(etc, code) if code not in tables else None
                if column is None:
                    entry['_rows'] = child['rows']
                else:
                    tables[column] = dumps(child['rows']); entry['_column'] = column
            meta.append(entry)
        tables['_children'] = dumps(meta)
        self.write_row(etc, tables)

    def rows_of(self, table, where, args):
        cursor = self.db.execute(f'SELECT * FROM {quote(table)} WHERE {where}', args)
        names = [description[0] for description in cursor.description]
        return [dict(zip(names, row)) for row in cursor.fetchall()]

    @staticmethod
    def unkeyed(row):
        values = {key: loads(value) for key, value in row.items() if not key.startswith('_') and value is not None}
        values.update(loads(row['_extra']) if row.get('_extra') else {})
        return dict(sorted(values.items()))

    def records(self, stage, where='1', args=()):
        main, items, etc = f'g2b_{stage}', f'g2b_{stage}_items', f'g2b_{stage}_etc'
        result = []
        for row in self.rows_of(main, where + ' ORDER BY _record_id', args):
            rid, extra = row['_record_id'], loads(row['_extra']) if row['_extra'] else {}
            fields = {key: loads(value) for key, value in row.items() if not key.startswith('_') and value is not None}
            fields = dict(sorted({**fields, **extra.get('fields', {})}.items()))
            record = {'recordId': rid, 'stage': stage, 'identity': [row[key] for key in sorted((key for key in row if re.fullmatch(r'_key[0-9]+', key)), key=lambda key: int(key[4:])) if row[key] is not None],
                      'fields': fields, 'storeVersion': row['_store_version'], 'userValues': loads(row['_user_values'])}
            for key, column in (('capturedAt', '_captured_at'), ('deletedAt', '_deleted_at')):
                if row[column] is not None:
                    record[key] = row[column]
            if row['_source'] is not None:
                record['source'] = loads(row['_source'])
            # A deleted etc DB table or row reads as no child tables and no raw JSON (결정 3: 해당 DB 테이블만 지운다).
            tables = (self.rows_of(etc, '_record_id=?', (rid,)) or [{'_raw_json': None, '_children': '[]'}])[0]
            if tables['_raw_json'] is not None:
                record['rawJson'] = tables['_raw_json']
            lines = {}
            for line in self.rows_of(items, '_record_id=? ORDER BY _child, _line', (rid,)):
                lines.setdefault(line['_child'], []).append(self.unkeyed(line))
            children = []
            for position, entry in enumerate(loads(tables['_children'])):
                is_items, column, spilled = entry.pop('_items', False), entry.pop('_column', None), entry.pop('_rows', None)
                rows = lines.get(position, []) if is_items else spilled if column is None else loads(tables[column])
                children.append({**entry, 'rows': rows})
            record['children'] = children
            record.update(extra.get('record', {}))
            result.append(record)
        return result

    def get(self, rid):
        stage = rid.split(':', 1)[0]
        found = self.records(stage, '_record_id=?', (rid,)) if stage in IDENTITIES else []
        return found[0] if found else None

    def read_settings(self):
        shared = self.db.execute('SELECT store_version, payload FROM settings_shared').fetchone()
        personal = self.db.execute('SELECT payload FROM settings_personal').fetchone()
        return shared[0], {**loads(shared[1]), **loads(personal[0])}

    def write_settings(self, settings, version=None):
        """Splits the settings into shared and personal (#90 answer 1); False when another window saved first."""
        personal = {key: value for key, value in settings.items() if key in PERSONAL_SETTINGS}
        shared = {key: value for key, value in settings.items() if key not in PERSONAL_SETTINGS}
        cursor = self.db.execute('UPDATE settings_shared SET store_version=store_version+1, payload=? WHERE singleton=1' + ('' if version is None else ' AND store_version=?'),
                                 (dumps(shared),) + (() if version is None else (version,)))
        if cursor.rowcount != 1:
            return False
        self.db.execute('UPDATE settings_personal SET store_version=(SELECT store_version FROM settings_shared), payload=? WHERE singleton=1', (dumps(personal),))
        return True

    def convert_legacy(self):
        """Moves the one-JSON records and settings into the DB tables once; the old DB tables are renamed and kept (#90 answer 6)."""
        self.db.execute('BEGIN IMMEDIATE')
        try:
            # After a downgrade the old version made a fresh mvp_settings from defaults: settings already moved stay.
            if self.db.execute('SELECT 1 FROM settings_shared').fetchone() is None:
                version, payload = self.db.execute('SELECT store_version, payload FROM mvp_settings WHERE singleton=1').fetchone()
                settings = loads(payload)
                self.db.execute('INSERT INTO settings_shared VALUES(1,?,?)', (version, dumps({k: v for k, v in settings.items() if k not in PERSONAL_SETTINGS})))
                self.db.execute('INSERT OR REPLACE INTO settings_personal VALUES(1,?,?)', (version, dumps({k: v for k, v in settings.items() if k in PERSONAL_SETTINGS})))
            for (stored,) in self.db.execute('SELECT payload FROM mvp_records ORDER BY record_id').fetchall():
                record = loads(stored)
                if self.get(record['recordId']) is not None:
                    continue  # after a downgrade: the record already moved keeps its later edits; the old copy stays in the renamed table
                record['children'] = [{**child, 'code': child.get('code') or legacy_code(record, child)} for child in record['children']]
                self.save(record)
            names = {row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            suffix = next(f'_v4{"" if index == 1 else "_" + str(index)}' for index in range(1, 1000) if f'mvp_records_v4{"" if index == 1 else "_" + str(index)}' not in names and f'mvp_settings_v4{"" if index == 1 else "_" + str(index)}' not in names)
            self.db.execute(f'ALTER TABLE mvp_records RENAME TO mvp_records{suffix}')
            self.db.execute(f'ALTER TABLE mvp_settings RENAME TO mvp_settings{suffix}')
            self.db.execute('DROP INDEX IF EXISTS mvp_stage')
            self.db.executemany('INSERT OR REPLACE INTO schema_versions VALUES(?,?)', SCHEMA_VERSIONS.items())
            self.db.execute('COMMIT')
        except Exception:
            self.db.execute('ROLLBACK'); self.columns.clear(); raise

    def order_index(self, stage):
        """Business number -> [(order, recordId)] of the stage's records outside the trash, read once per comparison."""
        index = {}
        for rid, number, order in self.db.execute(f'SELECT _record_id, _key1, _key2 FROM g2b_{stage} WHERE _deleted_at IS NULL'):
            index.setdefault(number, []).append((order, rid))
        return index

    def previous_order(self, stage, identity, index=None):
        """The latest earlier order of the same business number outside the trash, if any."""
        orders = (self.order_index(stage) if index is None else index).get(identity[0], [])
        earlier = [entry for entry in orders if order_key(entry[0]) < order_key(identity[1])]
        return self.get(max(earlier, key=lambda entry: order_key(entry[0]))[1]) if earlier else None

    def drop_corrections_and_locks(self):
        """
        Source values are not edited any more (user, 2026-10-09, #42): a stored correction gives way to the collected
        value (당초값) it covered, the correction records go, and so do the column locks.
        """
        for (payload,) in self.db.execute("SELECT payload FROM mvp_records WHERE json_type(payload, '$.sourceFields') IS NOT NULL OR json_type(payload, '$.overrides') IS NOT NULL").fetchall():
            record = loads(payload)
            fields = record.pop('sourceFields', record['fields']); record.pop('overrides', None)
            self.save_v4({**record, 'fields': fields, 'storeVersion': record['storeVersion'] + 1})
        settings = loads(self.db.execute('SELECT payload FROM mvp_settings WHERE singleton=1').fetchone()[0])
        if 'columnLocks' in settings:
            settings.pop('columnLocks')
            self.db.execute('UPDATE mvp_settings SET store_version=store_version+1,payload=? WHERE singleton=1', (dumps(settings),))

    def name_child_tables(self):
        """Stored child tables take their names, and stored attachment and second bid contact tables go (#44)."""
        for (payload,) in self.db.execute('SELECT payload FROM mvp_records').fetchall():
            record = loads(payload)
            children = named_children(record['stage'], record['children'])
            # Only a real rename counts; the collection code is new in #90 and set by convert_legacy.
            if not same([{k: v for k, v in child.items() if k != 'code'} for child in children], record['children']):
                self.save_v4({**record, 'children': children, 'storeVersion': record['storeVersion'] + 1})

    def compare(self, observations):
        require(isinstance(observations, list) and 0 < len(observations) <= 20000, '수집 대상이 없거나 너무 많습니다.')
        changes, records, versions, seen, items, order_indexes = [], [], [], set(), [], {}
        counts = {'inserted': 0, 'identical': 0, 'supplemented': 0, 'changed': 0}
        settings = self.read_settings()[1]
        for observation in observations:
            validate_observation(observation, settings.get('screenRules'))
            observation = {**observation, 'fields': decoded(observation['fields']), 'children': [{**child, 'rows': decoded(child['rows'])} for child in observation['children']]}
            incoming, named = observation['fields'], named_children(observation['stage'], observation['children'])
            rid = record_id(observation)
            require(rid not in seen, '한 요청에 같은 업무키가 여러 번 있습니다.', 'AMBIGUOUS')
            seen.add(rid)
            previous = self.get(rid)
            require(previous is None or not previous.get('deletedAt'), '휴지통의 자료입니다. 먼저 복원한 뒤 수집하세요.', 'TRASHED')
            versions.append((rid, previous['storeVersion'] if previous else None))
            if previous is None:
                # A new order keeps the screen's source values and takes the user columns of the previous order, which stays (#34).
                if observation['stage'] not in order_indexes:
                    order_indexes[observation['stage']] = self.order_index(observation['stage'])
                user, carried = default_user_values(observation['stage']), False
                earlier = self.previous_order(observation['stage'], observation['identity'], order_indexes[observation['stage']])
                if earlier is not None:
                    versions.append((earlier['recordId'], earlier['storeVersion']))
                    values, carried = carried_user_values(observation['stage'], earlier)
                    user = {**user, **values}
                records.append({**copy.deepcopy(observation), 'children': named, 'recordId': rid, 'storeVersion': 1, 'userValues': user})
                counts['inserted'] += 1; items.append({'recordId': rid, 'status': 'inserted', **({'carriedFrom': earlier['identity'][1]} if carried else {})}); continue
            before_changes = len(changes)
            fields = merge_fields(previous['fields'], incoming, rid, changes)
            children = merge_children(previous['children'], named, rid, changes)
            changed = not same(fields, previous['fields']) or not same(children, previous['children'])
            status = 'changed' if len(changes) > before_changes else 'supplemented' if changed else 'identical'
            counts[status] += 1; items.append({'recordId': rid, 'status': status})
            records.append({**previous, **({'fields': fields, 'children': children, 'rawJson': observation['rawJson'], 'source': observation['source'], 'capturedAt': observation['capturedAt'], 'storeVersion': previous['storeVersion'] + 1} if changed else {})})
        token = {'observations': observations, 'versions': versions}
        return {'token': digest(token), 'observations': observations, 'changes': changes, 'counts': counts, 'items': items}, records

    def dispatch(self, command, payload):
        if command == 'mvp.health':
            return {'connected': True, 'storage': 'SQLite', 'protocolVersion': 1}
        if command == 'mvp.records':
            require(payload.get('stage') in IDENTITIES, '업무 종류를 확인하세요.')
            require('trashed' not in payload or type(payload['trashed']) is bool, '휴지통 조회는 체크값이어야 합니다.')
            records = self.records(payload['stage'], '_deleted_at IS ' + ('NOT NULL' if payload.get('trashed', False) else 'NULL'))
            return [{**public(record), **({'computed': values} if (values := computed_values(record)) else {})} for record in records]
        if command in ('mvp.trash', 'mvp.restore'):
            changes = payload.get('records')
            require(isinstance(changes, list) and 0 < len(changes) <= 20000, '이동할 행이 없거나 너무 많습니다.')
            require(all(isinstance(change, dict) and isinstance(change.get('recordId'), str) and type(change.get('storeVersion')) is int for change in changes), '행 번호와 저장 버전을 확인하세요.')
            require(len({change['recordId'] for change in changes}) == len(changes), '이동할 행이 중복되었습니다.')
            timestamp = datetime.now(timezone.utc).isoformat()
            for change in changes:
                previous = self.get(change['recordId'])
                require(previous is not None, '이동할 자료가 없습니다.')
                require(previous['storeVersion'] == change['storeVersion'], '자료가 다른 창에서 바뀌었습니다. 다시 조회하세요.', 'STALE')
                require(bool(previous.get('deletedAt')) == (command == 'mvp.restore'), '자료의 휴지통 상태가 바뀌었습니다. 다시 조회하세요.', 'STALE')
                record = {**previous, 'storeVersion': previous['storeVersion'] + 1}
                if command == 'mvp.trash':
                    record['deletedAt'] = timestamp
                else:
                    record.pop('deletedAt', None)
                self.save(record)
            return {'count': len(changes)}
        if command == 'mvp.reset':
            # 초기화 (user, 2026-10-14, #125): the stage's collected records go with their DB tables; settings stay.
            stage = payload.get('stage')
            require(stage in IDENTITIES, '업무 종류를 확인하세요.')
            for table in (f'g2b_{stage}', f'g2b_{stage}_items', f'g2b_{stage}_etc'):
                self.db.execute(f'DROP TABLE IF EXISTS {table}')
            self.columns.clear(); self.create_tables()
            return {'stage': stage}
        if command == 'mvp.columns.remove':
            # 열 삭제 (user, 2026-10-14, #125): source columns leave every record of the stage, values included.
            stage, keys = payload.get('stage'), payload.get('keys')
            require(stage in IDENTITIES, '업무 종류를 확인하세요.')
            require(isinstance(keys, list) and keys and all(isinstance(key, str) for key in keys) and len(set(keys)) == len(keys), '지울 열을 확인하세요.')
            require(not set(keys) & set(IDENTITIES[stage]), '업무키 열은 지울 수 없습니다.')
            for record in self.records(stage):
                if set(keys) & set(record['fields']):
                    self.save({**record, 'fields': {key: value for key, value in record['fields'].items() if key not in keys}, 'storeVersion': record['storeVersion'] + 1})
            main, columns = f'g2b_{stage}', self.table_columns(f'g2b_{stage}')
            for key in keys:
                if key and not key.startswith('_') and columns.get(key.lower()) == key:  # '' and '_…' fields live in _extra; fixed columns stay
                    self.db.execute(f'ALTER TABLE {quote(main)} DROP COLUMN {quote(key)}')
            self.columns.pop(main, None)
            return {'stage': stage, 'keys': keys}
        if command == 'mvp.preview':
            return self.compare(payload.get('observations'))[0]
        if command == 'mvp.apply':
            preview, records = self.compare(payload.get('observations'))
            require(payload.get('token') == preview['token'], '자료가 바뀌었습니다. 다시 비교하세요.', 'STALE')
            for record in records:
                self.save(record)
            return {'records': [public(record) for record in records], 'counts': preview['counts'], 'changes': preview['changes'], 'items': preview['items']}
        if command == 'mvp.edit':
            changes = payload.get('records')
            column_change = payload.get('userColumns')
            if 'userColumns' in payload:
                require(isinstance(column_change, dict) and isinstance(column_change.get('stage'), str) and column_change['stage'] in IDENTITIES, '사용자 열의 업무를 확인하세요.')
                require(valid_user_column_keys(column_change.get('keys')), '사용자 열 이름은 중복 없는 문자열 목록이어야 합니다.')
                require(type(column_change.get('settingsStoreVersion')) is int, '설정 버전은 정수여야 합니다.')
            # Values of removed user columns the user chose to delete with the definition (user, 2026-10-09, #46).
            remove = column_change.get('removeValues', []) if column_change is not None else []
            require(isinstance(remove, list) and all(isinstance(name, str) for name in remove), '값을 지울 사용자 열을 확인하세요.')
            remove = set(remove)
            if column_change is not None:
                # New user column names may not be a source key of the stage or a label (user, 2026-10-09, #47).
                current = self.read_settings()[1]
                stored = self.records(column_change['stage'])
                # Names already in use stay usable: saved definitions, the stage's default columns and names records already hold.
                held = {key for record in stored for key in record['userValues']}
                added = [name for name in column_change['keys'] if name not in current.get('userColumns', {}).get(column_change['stage'], []) and name not in held and name not in default_user_values(column_change['stage']) and name not in DERIVED_USER_FIELDS]
                taken = {key for record in stored for key in record['fields']} if added else set()
                dictionary = current.get('dictionary', {}).get('keys', {})
                taken |= {dictionary[key] for key in taken if dictionary.get(key)}  # the labels of those keys
                require(not [name for name in added if name in taken], '원천 키나 라벨과 겹치는 사용자 열 이름은 쓸 수 없습니다.')
            fixed = set(CONTRACT_USER_DEFAULTS) | DERIVED_USER_FIELDS if column_change and column_change['stage'] == 'contract' else set()
            require(not remove & set(column_change['keys'] if column_change else []) and not remove & fixed, '정의된 사용자 열이나 계약 기본 열의 값은 지울 수 없습니다.')
            require(isinstance(changes, list) and (changes or column_change is not None), '저장할 행이 없습니다.')
            require(all(isinstance(c, dict) for c in changes), '수정 행이 객체여야 합니다.')
            require(len({c.get('recordId') for c in changes if isinstance(c, dict)}) == len(changes), '수정 행이 중복되었습니다.')
            records = []
            for change in changes:
                previous = self.get(change.get('recordId', ''))
                require(previous is not None, '수정할 자료가 없습니다.')
                require(not previous.get('deletedAt'), '휴지통 자료는 먼저 복원하세요.', 'TRASHED')
                require(column_change is None or previous['stage'] == column_change['stage'], '다른 업무의 행과 사용자 열을 함께 저장할 수 없습니다.')
                require(type(change.get('storeVersion')) is int and change['storeVersion'] == previous['storeVersion'], '다른 창에서 수정되었습니다. 입력을 유지하고 재조회하세요.', 'STALE')
                user = change.get('userValues')
                require(isinstance(user, dict), '수정 열을 확인하세요.')
                # Source values are read only; only user columns are edited (user, 2026-10-09, #42).
                require('fields' not in change or same(change['fields'], previous['fields']), '원천 값은 고칠 수 없습니다. 사용자 열만 고칩니다.', 'READ_ONLY')
                require(not DERIVED_USER_FIELDS.intersection(user), '계산 열은 저장하지 않습니다.')
                if previous['stage'] == 'contract':
                    require(isinstance(user.get('종결', False), bool), '종결은 체크값이어야 합니다.')
                    require(all(isinstance(user.get(k, ''), str) for k in ('지정일', '선금보증기한')), '사용자 날짜는 원래 입력 문자열로 저장합니다.')
                    require(all(isinstance(user.get(k, ''), (str, int)) and not isinstance(user.get(k, ''), bool) for k in ('종결금액', '선금보증금액')), '사용자 금액은 정확한 문자열 또는 정수여야 합니다.')
                    user = {**default_user_values('contract'), **user}
                else:
                    require('종결' not in user, '종결은 계약에만 있습니다.')
                user = {key: value for key, value in user.items() if key not in remove}
                record = {**previous, 'userValues': user, 'storeVersion': previous['storeVersion'] + 1}
                self.save(record); records.append(record)
            if column_change is not None:
                settings = self.read_settings()[1]
                settings['userColumns'] = {**settings.get('userColumns', {}), column_change['stage']: copy.deepcopy(column_change['keys'])}
                require(self.write_settings(settings, column_change['settingsStoreVersion']), '사용자 열 설정이 다른 창에서 바뀌었습니다. 입력을 유지하고 재조회하세요.', 'STALE')
                for record in self.records(column_change['stage']) if remove else []:
                    if remove & set(record['userValues']):
                        self.save({**record, 'userValues': {key: value for key, value in record['userValues'].items() if key not in remove}, 'storeVersion': record['storeVersion'] + 1})
            return [public(record) for record in records]
        if command == 'mvp.settings.read':
            version, settings = self.read_settings()
            return {'storeVersion': version, 'settings': settings}
        if command == 'mvp.settings.save':
            settings = payload.get('settings', {})
            require(isinstance(settings, dict), '설정이 객체여야 합니다.')
            require(settings.get('theme') in ('light', 'dark') and settings.get('extractionMode') in ('tables', 'all'), '표시 설정을 확인하세요.')
            require(all(isinstance(settings.get(k), bool) for k in ('hideEmptyColumns', 'hideUnmappedColumns')), '숨김 설정은 체크값이어야 합니다.')
            require('hideEmptyTables' not in settings or type(settings['hideEmptyTables']) is bool, '빈 표 숨김은 체크값이어야 합니다.')
            require('hideDuplicateTables' not in settings or type(settings['hideDuplicateTables']) is bool, '중복 표 숨김은 체크값이어야 합니다.')
            require(settings.get('collectMode', 'all') in ('all', 'skip'), '수집 방식을 확인하세요.')
            require('hideDuplicateRows' not in settings or type(settings['hideDuplicateRows']) is bool, '중복 행 숨김은 체크값이어야 합니다.')
            dictionary = settings.get('dictionary', {})
            require(isinstance(dictionary, dict), '키/값 사전이 객체여야 합니다.')
            require(isinstance(dictionary.get('keys'), dict) and all(isinstance(v, str) for v in dictionary['keys'].values()), '키 사전을 확인하세요.')
            require(isinstance(dictionary.get('values'), dict) and all(isinstance(v, dict) and all(isinstance(t, str) for t in v.values()) for v in dictionary['values'].values()), '값 사전을 확인하세요.')
            require(isinstance(settings.get('launchers'), list) and all(isinstance(c, dict) and all(isinstance(c.get(k), str) for k in ('id', 'label', 'script')) and isinstance(c.get('shortcut', ''), str) for c in settings['launchers']), '런처를 확인하세요.')
            require(isinstance(settings.get('columnTypes', {}), dict) and all(isinstance(v, str) and v in ('text', 'number', 'money', 'percent', 'date', 'datetime', 'boolean') for v in settings.get('columnTypes', {}).values()), '열 타입을 확인하세요.')
            formats = settings.get('columnFormats', {})
            require(isinstance(formats, dict) and all(isinstance(value, dict) and set(value) <= {'decimals', 'grouping', 'dateFormat'}
                    and ('decimals' not in value or type(value['decimals']) is int and 0 <= value['decimals'] <= 20)
                    and ('grouping' not in value or type(value['grouping']) is bool)
                    and ('dateFormat' not in value or isinstance(value['dateFormat'], str) and value['dateFormat'] in ('dot', 'dash', 'compact')) for value in formats.values()), '열 서식을 확인하세요.')
            require(isinstance(settings.get('outputColumns', {}), dict) and all(isinstance(key, str) and type(value) is bool for key, value in settings.get('outputColumns', {}).items()), '출력 열 설정을 확인하세요.')
            settings.pop('columnLocks', None)  # column locks were withdrawn (#42); a window opened before that may still send them
            require('screenRules' not in settings or valid_screen_rules(settings['screenRules']), '수집 화면 규칙을 확인하세요.')
            require(isinstance(settings.get('documentProfiles', {}), dict) and all(k in IDENTITIES and isinstance(v, str) and 0 < len(v) <= 200 for k, v in settings.get('documentProfiles', {}).items()), '업무별 문서 서식을 확인하세요.')
            require(valid_document_links(settings.get('documentLinks', {})), '업무·서식별 필드 연결을 확인하세요.')
            require(isinstance(settings.get('shortcuts', {}), dict) and all(k in ('extract', 'collect', 'db', 'document', 'launcher') and isinstance(v, str) for k, v in settings.get('shortcuts', {}).items()), '단축키를 확인하세요.')
            # A launcher key may not take another shortcut; the widget matches keys case-insensitively and fills the defaults (#69).
            keys = [v for v in {**default_settings()['shortcuts'], **settings.get('shortcuts', {})}.values() if v] + [c['shortcut'] for c in settings['launchers'] if c.get('shortcut')]
            taken = next((key for i, key in enumerate(keys) if key.lower() in (k.lower() for k in keys[:i])), None)
            require(taken is None, f'단축키가 겹칩니다: {taken}')
            require(isinstance(settings.get('userColumns', {}), dict) and all(stage in IDENTITIES and valid_user_column_keys(columns) for stage, columns in settings.get('userColumns', {}).items()), '사용자 열 설정을 확인하세요.')
            require(all(key not in settings or isinstance(settings[key], str) and settings[key].strip() for key in ('contractEndField', 'contractAmountField')), '계약 계산 기준 열을 확인하세요.')
            require(type(payload.get('storeVersion')) is int, '설정 버전은 정수여야 합니다.')
            require(self.write_settings(settings, payload.get('storeVersion')), '설정이 다른 창에서 바뀌었습니다. 다시 여세요.', 'STALE')
            return self.dispatch('mvp.settings.read', {})
        raise Fault('COMMAND', '등록되지 않은 명령입니다.')

    def handle(self, request):
        rid = request.get('requestId', '') if isinstance(request, dict) else ''
        response = {'protocolVersion': 1, 'requestId': rid}
        try:
            require(isinstance(request, dict) and type(request.get('protocolVersion')) is int and request['protocolVersion'] == 1 and isinstance(rid, str) and 0 < len(rid) <= 200, '요청 버전/번호를 확인하세요.')
            command, payload = request.get('command'), request.get('payload')
            require(isinstance(command, str) and isinstance(payload, dict), '명령/본문 형식을 확인하세요.')
            if command in DOCUMENT_COMMANDS:
                # No Helper write transaction is held while the generator runs.
                response['result'] = document_forward(command, payload, rid)
                return response
            with self.lock:
                fingerprint = digest(request)
                cached = self.db.execute('SELECT fingerprint,response FROM mvp_requests WHERE request_id=?', (rid,)).fetchone()
                if cached:
                    require(cached[0] == fingerprint, '같은 요청 번호에 다른 내용이 들어왔습니다.', 'REQUEST_ID')
                    return loads(cached[1])
                self.db.execute('BEGIN IMMEDIATE' if command in WRITE else 'BEGIN')
                try:
                    response['result'] = self.dispatch(command, payload)
                    if command in WRITE:
                        self.db.execute('INSERT INTO mvp_requests VALUES(?,?,?)', (rid, fingerprint, dumps(response)))
                    self.db.execute('COMMIT')
                except Exception:
                    self.db.execute('ROLLBACK'); self.columns.clear(); raise
        except Fault as error:
            response['error'] = {'code': error.code, 'message': str(error)}
        except (TypeError, ValueError, KeyError, sqlite3.Error) as error:
            response['error'] = {'code': 'VALIDATION', 'message': str(error)}
        return response
