"""휴지통: 메인 행에 deleted_at을 찍거나 지운다. 행은 지우지 않는다."""
from datetime import datetime, timezone

from core.errors import NotWritable
from core.sql_schema import parse_table, quote_ident


def _main_table(table):
    if parse_table(table)[0] != "main":
        raise NotWritable("휴지통은 단계 메인 테이블에만 있다")
    return quote_ident(table)


def trash_record(db, table, record_id):
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with db.tx():
        sql = f"UPDATE {_main_table(table)} SET deleted_at = ? WHERE record_id = ? AND deleted_at IS NULL"
        return db.run(sql, (stamp, record_id)).rowcount == 1


def restore_record(db, table, record_id):
    with db.tx():
        sql = f"UPDATE {_main_table(table)} SET deleted_at = NULL WHERE record_id = ? AND deleted_at IS NOT NULL"
        return db.run(sql, (record_id,)).rowcount == 1
