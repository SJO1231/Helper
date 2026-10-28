"""dict_* 쓰기(POST·PATCH·PUT). 키·하위 표 승격과 공개 뷰 갱신도 같은 트랜잭션에서 한다."""
from core import child_promotion, promotion, schema_views
from core.dict_codec import PRIMARY_KEYS, decode_row, encode_fields
from core.dict_rules import check_fields
from core.errors import BadRequest, NotFound, NotWritable
from core.rawhash import raw_hash
from core.request_once import once
from core.sql_records import insert_statement, update_statement, where_equal
from core.sql_schema import WRITABLE_DICT, quote_ident

VIEW_TABLES = ("dict_key", "dict_label")


def add_records(db, table, records, request_id=None):
    def work():
        out = []
        for record in _records(records):
            fields = _prepare(db, table, record.get("fields"))
            row_id = db.run(*insert_statement(table, fields)).lastrowid
            after = _row(db, table, "rowid = ?", (row_id,))
            _fire(db, table, None, after)
            out.append({"id": row_id, "fields": _public(after)})
        return out
    return _write(db, table, records, request_id, work)


def update_records(db, table, records, request_id=None):
    def work():
        out = []
        for record in _records(records):
            row_id = record.get("id")
            before = _row(db, table, "rowid = ?", (row_id,)) if isinstance(row_id, int) else None
            if before is None:
                raise NotFound("고칠 행이 없다")
            fields = _prepare(db, table, record.get("fields"))
            _guard_keys(table, before, fields)
            if fields:
                db.run(*update_statement(table, fields, "rowid = ?", (row_id,)))
            _fire(db, table, before, _row(db, table, "rowid = ?", (row_id,)))
            out.append({"id": row_id})
        return out
    return _write(db, table, records, request_id, work)


def upsert_records(db, table, records, noupdate=False, request_id=None):
    def work():
        out = []
        for record in _records(records):
            require = _prepare(db, table, record.get("require"))
            if set(require) != set(PRIMARY_KEYS[table]):
                raise BadRequest(f"require에는 {', '.join(PRIMARY_KEYS[table])}만 적는다")
            where, params = where_equal(require)
            before = _row(db, table, where, params)
            if before is None:
                fields = {**_prepare(db, table, record.get("fields")), **require}
                row_id = db.run(*insert_statement(table, fields)).lastrowid
            else:
                row_id = before["_id"]
                if not noupdate:
                    fields = _prepare(db, table, record.get("fields"))
                    _guard_keys(table, before, fields)
                    if fields:
                        db.run(*update_statement(table, fields, "rowid = ?", (row_id,)))
            if before is None or not noupdate:
                _fire(db, table, before, _row(db, table, "rowid = ?", (row_id,)))
            out.append({"id": row_id})
        return out
    return _write(db, table, [records, noupdate], request_id, work)


def _write(db, table, body, request_id, work):
    if table not in WRITABLE_DICT:
        db.require_table(table)
        raise NotWritable(f"{table}에는 쓸 수 없다")

    def produce():
        if table == "dict_key":
            schema_views.drop(db)  # 열을 지우려면 그 열을 쓰는 뷰가 먼저 없어야 한다
        result = work()
        if table in VIEW_TABLES:
            schema_views.rebuild(db)
        return result, True
    return once(db, request_id, raw_hash({"table": table, "body": body}), produce)


def _records(records):
    if not isinstance(records, list) or not all(isinstance(r, dict) for r in records):
        raise BadRequest("records는 객체의 목록이어야 한다")
    return records


def _prepare(db, table, fields):
    if not isinstance(fields, dict):
        raise BadRequest("fields(require)는 객체여야 한다")
    unknown = set(fields) - set(db.table_columns(table))
    if unknown:
        raise BadRequest(f"{table}에 없는 열이다: {', '.join(sorted(unknown))}")
    check_fields(table, fields)
    return encode_fields(table, fields)


def _guard_keys(table, before, fields):
    for name in PRIMARY_KEYS[table]:
        if name in fields and fields[name] != before[name]:
            raise BadRequest("키 열은 바꿀 수 없다. 새 행을 더한다")


def _row(db, table, where, params):
    rows = db.rows(f"SELECT rowid AS _id, * FROM {quote_ident(table)} WHERE {where}", params)
    return decode_row(table, rows[0]) if rows else None


def _public(row):
    return {name: value for name, value in row.items() if name != "_id"}


def _fire(db, table, before, after):
    if table == "dict_key":
        promotion.sync_key(db, before, after)
    elif table == "dict_child":
        child_promotion.sync_child(db, before, after)
