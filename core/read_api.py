"""읽기: 표 목록·열·쪽 단위 레코드. db는 gateway다."""
from core import dict_read
from core.dict_codec import PRIMARY_KEYS, decode_row
from core.dictionary import label_index, resolve_label
from core.errors import BadRequest, NotFound
from core.sql_query import order_by, where_clause
from core.sql_schema import CAPTURE_COLUMNS, PUBLIC_SKIP, SITE, key_stage_name, parse_table, quote_ident

DEFAULT_LIMIT = 500
MAX_LIMIT = 5000
ID_COLUMNS = {"main": "record_id", "capture": "capture_id"}
KIND_LABELS = {"capture": "수집 이력"}
# 수집 이력은 최근 것부터 읽는다. 다른 테이블은 정렬을 안 주면 넣은 순서(rowid)다
DEFAULT_SORTS = {"capture": "-captured_at,-capture_id"}


def list_tables(db):
    out = []
    for row in db.rows("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"):
        kind, stage, _ = parse_table(row["name"])
        if kind and row["name"] not in PUBLIC_SKIP:
            label = KIND_LABELS.get(kind, row["name"])
            out.append({"id": row["name"], "fields": {"label": label, "stage": stage, "kind": kind}})
    return out


def require_table(db, table):
    kind, stage, alias = parse_table(table) if isinstance(table, str) else (None, None, None)
    if kind is None or not db.table_columns(table):
        raise NotFound("없는 테이블이다")
    return kind, stage, alias


def list_columns(db, table):
    kind, stage, alias = require_table(db, table)
    if kind in ("main", "item", "typed"):
        index = label_index(dict_read.labels(db))
        return [{"id": key["std_key"], "fields": {
            "label": resolve_label(index, key["std_key"], None, SITE, key["label"] or key["std_key"]),
            "type": key["type"], "index": bool(key["index"])}}
            for key in dict_read.column_keys(db, key_stage_name(stage, alias))]
    if kind == "capture":
        return [{"id": name, "fields": {"label": label, "type": "text", "index": False}}
                for name, label in CAPTURE_COLUMNS]
    # 사전 표의 기본키 열은 뷰어가 편집 불가로 둔다
    primary = PRIMARY_KEYS.get(table, ())
    columns = []
    for name in db.table_columns(table):
        fields = {"label": name, "type": "text", "index": False}
        if name in primary:
            fields["primary"] = True
        columns.append({"id": name, "fields": fields})
    return columns


def list_records(db, table, sort=None, filters=None, limit=DEFAULT_LIMIT, offset=0):
    kind, stage, alias = require_table(db, table)
    if not isinstance(limit, int) or not isinstance(offset, int) or limit < 0 or offset < 0:
        raise BadRequest("limit·offset은 0 이상의 정수여야 한다")
    limit = min(limit, MAX_LIMIT)
    # raw는 크고 목록에 내지 않는 열이라 정렬·필터 대상에서도 뺀다
    columns = [name for name, _ in CAPTURE_COLUMNS] if kind == "capture" else db.table_columns(table)
    types = {}
    if kind in ("main", "item", "typed"):
        types = {k["std_key"]: k["type"] for k in dict_read.column_keys(db, key_stage_name(stage, alias))}
    where, params = where_clause(filters, columns, hide_deleted=kind == "main")
    name = quote_ident(table)
    total = db.rows(f"SELECT COUNT(*) AS n FROM {name}{where}", params)[0]["n"]
    shown = "*" if kind != "capture" else ", ".join(quote_ident(column) for column, _ in CAPTURE_COLUMNS)
    order = order_by(sort or DEFAULT_SORTS.get(kind), types, columns)
    sql = f"SELECT rowid AS _id, {shown} FROM {name}{where} ORDER BY {order} LIMIT ? OFFSET ?"
    id_column = ID_COLUMNS.get(kind, "_id")
    records = []
    for row in db.rows(sql, (*params, limit, offset)):
        row_id = row[id_column]
        row.pop("_id")
        records.append({"id": row_id, "fields": decode_row(table, row)})
    return records, total
