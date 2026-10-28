"""수집과 승격이 쓰는 사전 읽기. db는 gateway다."""
from core.dict_codec import decode_row


def screen(db, site, menu_no):
    rows = db.rows("SELECT * FROM dict_screen WHERE site = ? AND menu_no = ?", (site, menu_no))
    return decode_row("dict_screen", rows[0]) if rows else None


def aliases(db, site):
    return db.rows("SELECT screen_code, source_key, std_key FROM dict_alias WHERE site = ?", (site,))


def std_keys(db):
    return {row["std_key"] for row in db.rows("SELECT std_key FROM dict_key")}


def column_keys(db, stage_name):
    """stages에 stage_name(bid, bid_item ...)이 든 as_column=1 표준키, 만든 순서대로."""
    rows = db.rows("SELECT rowid AS rid, * FROM dict_key WHERE as_column = 1 ORDER BY rowid")
    decoded = [decode_row("dict_key", row) for row in rows]
    return [row for row in decoded if stage_name in row["stages"]]


def children(db, site):
    rows = db.rows("SELECT * FROM dict_child WHERE site = ?", (site,))
    return {row["table_code"]: decode_row("dict_child", row) for row in rows}


def labels(db):
    return db.rows('SELECT scope, scope_id, "key" AS key, label FROM dict_label')
