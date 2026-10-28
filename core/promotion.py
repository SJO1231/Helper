"""표준키 승격(SPEC 5.2): as_column·stages·index 변경을 열 추가·삭제와 과거 행 채우기로 옮긴다.
호출한 쪽의 트랜잭션 안에서 돈다. 예외가 나면 열 추가와 사전 변경이 함께 물러난다."""
import json

from core import dict_read
from core.dictionary import resolve_std_key
from core.errors import StorageError
from core.flatten import flatten
from core.sql_schema import (SITE, SITE_PREFIX, add_column_statement, create_index_statement,
                             drop_column_statement, drop_index_statement, parse_table, quote_ident)

CHUNK = 500


def chunked(db, sql, params=None, size=CHUNK):
    """sql은 :after(rowid 커서)·:size를 쓰고 rid 열을 돌려줘야 한다. 큰 DB를 한꺼번에 올리지 않으려는 것."""
    after = 0
    while True:
        rows = db.rows(sql, {**(params or {}), "after": after, "size": size})
        if not rows:
            return
        yield from rows
        after = rows[-1]["rid"]


def wanted_columns(key_row):
    if not key_row or not key_row["as_column"]:
        return {}
    return {SITE_PREFIX + stage: key_row["index"] for stage in key_row["stages"]}


def sync_key(db, before, after):
    std_key = (after or before)["std_key"]
    old, new = wanted_columns(before), wanted_columns(after)
    for table in old.keys() - new.keys():
        _drop_column(db, table, std_key)
    for table, indexed in new.items():
        columns = db.table_columns(table)
        if not columns:  # 승격된 하위 표가 아직 없다. 표를 만들 때 사전을 보고 열을 단다
            continue
        if std_key not in columns:
            db.run(add_column_statement(table, std_key))
            _backfill(db, table, std_key)
            if indexed:
                _set_index(db, table, std_key, indexed)
        elif old.get(table) != indexed:
            _set_index(db, table, std_key, indexed)


def _set_index(db, table, column, indexed):
    db.run(create_index_statement(table, column) if indexed else drop_index_statement(table, column))


def _drop_column(db, table, column):
    if column in db.table_columns(table):
        db.run(drop_index_statement(table, column))
        db.run(drop_column_statement(table, column))


def _parse(text, what):
    try:
        return json.loads(text)
    except ValueError as error:
        raise StorageError(f"{what}을 읽을 수 없어 과거 행을 채우지 못했다") from error


def _backfill(db, table, std_key):
    kind, stage, _ = parse_table(table)
    aliases, std_keys = dict_read.aliases(db, SITE), dict_read.std_keys(db)
    if kind == "main":
        _backfill_main(db, table, std_key, aliases, std_keys)
    else:
        _backfill_lines(db, table, SITE_PREFIX + stage, std_key, aliases, std_keys)


def _backfill_main(db, table, std_key, aliases, std_keys):
    name = quote_ident(table)
    sql = (f"SELECT m.rowid AS rid, m.record_id, m.screen_code, c.raw FROM {name} m"
           " JOIN g2b_capture c ON c.capture_id = m.latest_capture_id"
           " WHERE m.rowid > :after ORDER BY m.rowid LIMIT :size")
    for row in chunked(db, sql):
        raw = _parse(row["raw"], "수집 원본(raw)")
        value = flatten(raw, row["screen_code"], aliases, std_keys).values.get(std_key, "")
        if value != "":
            db.run(f"UPDATE {name} SET {quote_ident(std_key)} = ? WHERE record_id = ?", (value, row["record_id"]))


def _backfill_lines(db, table, main_table, std_key, aliases, std_keys):
    name = quote_ident(table)
    sql = (f"SELECT i.rowid AS rid, i.record_id, i.line_no, i.raw_line, m.screen_code FROM {name} i"
           f" LEFT JOIN {quote_ident(main_table)} m ON m.record_id = i.record_id"
           " WHERE i.rowid > :after ORDER BY i.rowid LIMIT :size")
    for row in chunked(db, sql):
        line = _parse(row["raw_line"], "표 행 원본(raw_line)")
        found = [v for k, v in line.items()
                 if v != "" and resolve_std_key(k, row["screen_code"], aliases, std_keys) == std_key]
        if found:
            db.run(f"UPDATE {name} SET {quote_ident(std_key)} = ? WHERE record_id = ? AND line_no = ?",
                   (found[0], row["record_id"], row["line_no"]))
