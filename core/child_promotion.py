"""하위 표 승격(SPEC 5절): typed 0→1이면 g2b_<단계>_<이름> 컬럼형 테이블로 행을 옮기고, 1→0이면 되돌린다."""
import json
import re

from core import dict_read
from core.errors import BadRequest
from core.lines import insert_line, line_values
from core.promotion import chunked
from core.sql_schema import SITE, SITE_PREFIX, line_table_statement, quote_ident

PLAIN_ALIAS = re.compile(r"^[A-Za-z][A-Za-z0-9]*$")


def is_typed(row):
    return bool(row and row["typed"] and row["alias"] != "item")  # item은 늘 물품 테이블이라 승격이 아니다


def table_of(row):
    return f"{SITE_PREFIX}{row['stage']}_{row['alias']}"


def sync_child(db, before, after):
    if is_typed(after):
        _check_typed(after)
    if is_typed(before) and is_typed(after):
        if (before["stage"], before["alias"]) != (after["stage"], after["alias"]):
            raise BadRequest("승격된 하위 표의 단계·이름은 typed를 0으로 되돌린 뒤 바꾼다")
    elif is_typed(after):
        _move_in(db, after)
    elif is_typed(before):
        _move_out(db, before)


def _check_typed(row):
    if row["stage"] is None:
        raise BadRequest("승격하려면 하위 표의 stage가 있어야 한다")
    if not PLAIN_ALIAS.match(row["alias"]) or row["alias"] == "child":
        raise BadRequest("승격할 하위 표의 이름은 영숫자이고 child가 아니어야 한다")


def _move_in(db, row):
    table, stage = table_of(row), row["stage"]
    columns = [k["std_key"] for k in dict_read.column_keys(db, f"{stage}_{row['alias']}")]
    db.run(line_table_statement(table, columns))
    child, main = quote_ident(f"{SITE_PREFIX}{stage}_child"), quote_ident(SITE_PREFIX + stage)
    sql = (f"SELECT c.rowid AS rid, c.record_id, c.line_no, c.raw_line, m.screen_code FROM {child} c"
           f" LEFT JOIN {main} m ON m.record_id = c.record_id"
           " WHERE c.table_code = :code AND c.rowid > :after ORDER BY c.rowid LIMIT :size")
    aliases, std_keys = dict_read.aliases(db, SITE), dict_read.std_keys(db)
    for moved in chunked(db, sql, {"code": row["table_code"]}):
        line = json.loads(moved["raw_line"])
        values = line_values(line, moved["screen_code"], aliases, std_keys, columns)
        insert_line(db, table, moved["record_id"], moved["line_no"], line, values)
    db.run(f"DELETE FROM {child} WHERE table_code = ?", (row["table_code"],))


def _move_out(db, row):
    table = table_of(row)
    if not db.table_columns(table):
        return
    child = quote_ident(f"{SITE_PREFIX}{row['stage']}_child")
    db.run(f"INSERT INTO {child} (record_id, table_code, line_no, raw_line)"
           f" SELECT record_id, ?, line_no, raw_line FROM {quote_ident(table)}", (row["table_code"],))
    db.run(f"DROP TABLE {quote_ident(table)}")
