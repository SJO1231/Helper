"""테이블·뷰·열 문장 만들기. DB를 모르는 순수 함수만 둔다."""
import re

SITE = "g2b"
SITE_PREFIX = SITE + "_"
STAGES = ("receipt", "bid", "contract")
MAIN_FIXED = ("record_id", "key1", "key2", "latest_capture_id", "captured_at", "screen_code",
              "store_version", "deleted_at", "user_values")
LINE_FIXED = ("record_id", "line_no", "raw_line")
DICT_TABLES = ("dict_key", "dict_alias", "dict_label", "dict_code", "dict_screen", "dict_child",
               "dict_relation", "user_column")
WRITABLE_DICT = DICT_TABLES[:6]
PUBLIC_SKIP = ("request_log", "schema_version", "settings_shared", "settings_personal")
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
TABLE_NAME = re.compile(r"^g2b_(receipt|bid|contract)(?:_([A-Za-z0-9]+))?$")

STATIC_TABLES = (
    "CREATE TABLE IF NOT EXISTS g2b_capture (capture_id INTEGER PRIMARY KEY AUTOINCREMENT, record_id TEXT,"
    " screen_code TEXT, url TEXT, captured_at TEXT, raw_hash TEXT NOT NULL UNIQUE, raw TEXT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS ix_g2b_capture_record ON g2b_capture (record_id, screen_code)",
    "CREATE TABLE IF NOT EXISTS dict_key (std_key TEXT PRIMARY KEY, module TEXT, stages TEXT NOT NULL DEFAULT '[]',"
    " type TEXT NOT NULL DEFAULT 'text', label TEXT, as_column INTEGER NOT NULL DEFAULT 0,"
    ' "index" INTEGER NOT NULL DEFAULT 0, derived INTEGER NOT NULL DEFAULT 0, display TEXT)',
    "CREATE TABLE IF NOT EXISTS dict_alias (site TEXT NOT NULL, screen_code TEXT NOT NULL DEFAULT '',"
    " source_key TEXT NOT NULL, std_key TEXT NOT NULL, PRIMARY KEY (site, screen_code, source_key))",
    "CREATE TABLE IF NOT EXISTS dict_label (scope TEXT NOT NULL, scope_id TEXT NOT NULL DEFAULT '',"
    ' "key" TEXT NOT NULL, label TEXT NOT NULL DEFAULT \'\', PRIMARY KEY (scope, scope_id, "key"))',
    "CREATE TABLE IF NOT EXISTS dict_code (std_key TEXT NOT NULL, code TEXT NOT NULL, meaning TEXT NOT NULL"
    " DEFAULT '', scope TEXT NOT NULL DEFAULT '', PRIMARY KEY (std_key, code, scope))",
    "CREATE TABLE IF NOT EXISTS dict_screen (site TEXT NOT NULL, menu_no TEXT NOT NULL,"
    " scrn_no TEXT NOT NULL DEFAULT '', menu_cang_val TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '',"
    " stage TEXT, source_route TEXT NOT NULL DEFAULT '', key_fields TEXT NOT NULL DEFAULT '[]', link TEXT,"
    " options TEXT NOT NULL DEFAULT '{}', PRIMARY KEY (site, menu_no))",
    "CREATE TABLE IF NOT EXISTS dict_child (site TEXT NOT NULL, table_code TEXT PRIMARY KEY, alias TEXT NOT NULL"
    " DEFAULT '', stage TEXT, typed INTEGER NOT NULL DEFAULT 0, key_fields TEXT NOT NULL DEFAULT '[]')",
    "CREATE TABLE IF NOT EXISTS dict_relation (relation_id INTEGER PRIMARY KEY, payload TEXT NOT NULL DEFAULT '{}')",
    "CREATE TABLE IF NOT EXISTS user_column (column_id INTEGER PRIMARY KEY, payload TEXT NOT NULL DEFAULT '{}')",
    "CREATE TABLE IF NOT EXISTS request_log (request_id TEXT PRIMARY KEY, fingerprint TEXT, response TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS schema_version (module TEXT PRIMARY KEY, version INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS settings_shared (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS settings_personal (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
)


def quote_ident(name):
    if not isinstance(name, str) or not IDENT.match(name):
        raise ValueError(f"이름으로 쓸 수 없는 글자가 있다: {name!r}")
    return '"' + name + '"'


def quote_alias(label):
    return '"' + label.replace('"', '""') + '"'


def main_table_statement(stage):
    return (f"CREATE TABLE IF NOT EXISTS {quote_ident(SITE_PREFIX + stage)} (record_id TEXT PRIMARY KEY,"
            " key1 TEXT, key2 TEXT, latest_capture_id INTEGER, captured_at TEXT, screen_code TEXT,"
            " store_version INTEGER NOT NULL DEFAULT 0, deleted_at TEXT, user_values TEXT NOT NULL DEFAULT '{}')")


def line_table_statement(table, std_columns=()):
    extra = "".join(f", {quote_ident(name)} TEXT" for name in std_columns)
    return (f"CREATE TABLE IF NOT EXISTS {quote_ident(table)} (record_id TEXT NOT NULL, line_no INTEGER NOT NULL,"
            f" raw_line TEXT NOT NULL{extra}, PRIMARY KEY (record_id, line_no))")


def child_table_statements(stage):
    table = SITE_PREFIX + stage + "_child"
    return [f"CREATE TABLE IF NOT EXISTS {quote_ident(table)} (record_id TEXT NOT NULL, table_code TEXT NOT NULL,"
            " line_no INTEGER NOT NULL, raw_line TEXT NOT NULL)",
            f"CREATE INDEX IF NOT EXISTS ix_{table} ON {quote_ident(table)} (record_id, table_code)"]


def create_statements():
    statements = list(STATIC_TABLES)
    for stage in STAGES:
        statements.append(main_table_statement(stage))
        statements.append(line_table_statement(f"{SITE_PREFIX}{stage}_item"))
        statements.extend(child_table_statements(stage))
    return statements


def add_column_statement(table, column):
    return f"ALTER TABLE {quote_ident(table)} ADD COLUMN {quote_ident(column)} TEXT"


def drop_column_statement(table, column):
    return f"ALTER TABLE {quote_ident(table)} DROP COLUMN {quote_ident(column)}"


def index_name(table, column):
    return f"ix_{table}_{column}"


def create_index_statement(table, column):
    return (f"CREATE INDEX IF NOT EXISTS {quote_ident(index_name(table, column))}"
            f" ON {quote_ident(table)} ({quote_ident(column)})")


def drop_index_statement(table, column):
    return f"DROP INDEX IF EXISTS {quote_ident(index_name(table, column))}"


def view_statement(stage, pairs):
    """pairs는 (표준키, 열 이름으로 쓸 라벨). 라벨이 겹치면 표준키를 덧붙여 가른다."""
    seen = {"record_id"}
    selects = ['"record_id" AS "record_id"']
    for std_key, label in pairs:
        name = label if label.lower() not in seen else f"{label} ({std_key})"
        seen.add(name.lower())
        selects.append(f"{quote_ident(std_key)} AS {quote_alias(name)}")
    table = quote_ident(SITE_PREFIX + stage)
    view = quote_ident("v_" + stage)
    return f"CREATE VIEW {view} AS SELECT {', '.join(selects)} FROM {table} WHERE deleted_at IS NULL"


def drop_view_statements():
    return [f"DROP VIEW IF EXISTS {quote_ident('v_' + stage)}" for stage in STAGES]


def parse_table(name):
    """(kind, stage, alias). 사용자에게 보이는 테이블이 아니면 kind는 None."""
    if name == "g2b_capture":
        return "capture", None, None
    if name in DICT_TABLES:
        return "dict", None, None
    if name == "user_column":
        return "user", None, None
    match = TABLE_NAME.match(name)
    if not match:
        return None, None, None
    stage, alias = match.groups()
    kind = "main" if alias is None else "item" if alias == "item" else "child" if alias == "child" else "typed"
    return kind, stage, alias


def key_stage_name(stage, alias):
    """dict_key.stages에 적는 이름: bid, bid_item, bid_party."""
    return stage if alias is None else f"{stage}_{alias}"
