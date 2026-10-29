"""수집 한 번을 SPEC 5.1 순서로 한 트랜잭션에 저장한다."""
import json
from datetime import datetime, timezone

from core import dict_read
from core.errors import BadRequest
from core.flatten import flatten
from core.lines import insert_line, line_values
from core.merge import merge_main
from core.rawhash import canonical, raw_hash
from core.record_key import build_record_id
from core.request_once import once
from core.sql_records import insert_statement, upsert_statement
from core.sql_schema import LINE_FIXED, SITE_PREFIX, quote_ident

DEFAULT_KEEP = 5
MODES = ("visible", "hidden", "all")


def write_capture(db, fields, request_id):
    _check_fields(fields)
    digest = raw_hash(fields["raw"])
    return once(db, request_id, digest, lambda: _store(db, fields, digest))


def _check_fields(fields):
    if not isinstance(fields, dict):
        raise BadRequest("수집 요청이 객체가 아니다")
    for name in ("site", "menu_no"):
        if not isinstance(fields.get(name), str) or not fields[name]:
            raise BadRequest(f"{name}이 없다")
    if fields.get("mode", "visible") not in MODES:
        raise BadRequest("mode가 visible·hidden·all이 아니다")
    raw = fields.get("raw")
    ok = isinstance(raw, dict) and isinstance(raw.get("state"), dict) and isinstance(raw.get("param"), dict)
    ok = ok and all(isinstance(raw.get(name), list) for name in ("pointInfo", "tables"))
    ok = ok and all(isinstance(p, dict) and isinstance(p.get("k"), str) for p in raw["pointInfo"])
    ok = ok and all(_valid_table(t) for t in raw["tables"])
    if not ok:
        raise BadRequest("raw의 모양이 맞지 않다")


def _valid_table(table):
    if not isinstance(table, dict) or not isinstance(table.get("dataList"), str):
        return False
    rows, columns = table.get("rows", []), table.get("columns", [])
    return (isinstance(rows, list) and all(isinstance(r, dict) for r in rows)
            and isinstance(columns, list) and all(isinstance(c, dict) and isinstance(c.get("k"), str) for c in columns))


def _store(db, fields, digest):
    site, menu_no = fields["site"], fields["menu_no"]
    screen = dict_read.screen(db, site, menu_no)
    aliases, std_keys = dict_read.aliases(db, site), dict_read.std_keys(db)
    flat = flatten(fields["raw"], menu_no, aliases, std_keys)
    stage = screen["stage"] if screen else None

    def result(status, record_id, changed=(), reason=None, restored=False):
        body = {"status": status, "record_id": record_id, "stage": stage, "changed": list(changed),
                "unknown_keys": flat.unknown_keys}
        if reason:
            body["reason"] = reason
        if restored:
            body["restored"] = True  # 휴지통에 있던 건을 다시 수집해 되살렸다
        return body

    if screen is None:
        return result("rejected", None, reason="화면 사전에 없는 화면이다"), False
    if stage is None:
        return result("rejected", None, reason="화면 사전에 단계(stage)가 없다"), False
    if not 1 <= len(screen["key_fields"]) <= 2:
        return result("rejected", None, reason="화면 사전의 업무키는 1~2개여야 한다"), False
    record_id, reason = build_record_id(flat.values, screen["key_fields"])
    if record_id is None:
        return result("rejected", None, reason=reason), False

    main = SITE_PREFIX + stage
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    capture_id = _capture_id_for_hash(db, digest)
    if capture_id is not None and _main_row_exists(db, main, record_id):
        db.run(f"UPDATE {quote_ident(main)} SET captured_at = ? WHERE record_id = ?", (now, record_id))
        restored = _restore_from_trash(db, main, record_id)
        return result("same", record_id, restored=restored), restored

    # 같은 원본이어도 단계가 바뀌어 메인 행이 없으면 capture는 재사용하고 메인 쓰기를 이어 한다
    if capture_id is None:
        capture_id = db.run(*insert_statement("g2b_capture", {
            "record_id": record_id, "screen_code": menu_no, "url": fields.get("url", ""), "captured_at": now,
            "raw_hash": digest, "raw": canonical(fields["raw"])})).lastrowid
    columns = [k["std_key"] for k in dict_read.column_keys(db, stage)]
    existing = _existing_values(db, main, record_id, columns)
    incoming = {k: v for k, v in flat.values.items() if k in columns}
    _, changed = merge_main(existing or {}, incoming)
    key_fields = screen["key_fields"]
    row = {"record_id": record_id, "key1": flat.values[key_fields[0]],
           "key2": flat.values[key_fields[1]] if len(key_fields) == 2 else None,
           "latest_capture_id": capture_id, "captured_at": now, "screen_code": menu_no,
           **{k: v for k, v in incoming.items() if v != ""}}
    db.run(*upsert_statement(main, row, "record_id"))
    db.run(f"UPDATE {quote_ident(main)} SET store_version = store_version + 1 WHERE record_id = ?", (record_id,))
    _store_tables(db, stage, record_id, menu_no, flat.tables, (dict_read.children(db, site), aliases, std_keys))
    _trim_captures(db, record_id, menu_no)
    restored = _restore_from_trash(db, main, record_id)
    if existing is None:
        return result("new", record_id, restored=restored), True
    return result("changed", record_id, changed, restored=restored), True


def _capture_id_for_hash(db, digest):
    rows = db.rows("SELECT capture_id FROM g2b_capture WHERE raw_hash = ? ORDER BY capture_id DESC LIMIT 1", (digest,))
    return rows[0]["capture_id"] if rows else None


def _main_row_exists(db, main, record_id):
    return bool(db.rows(f"SELECT 1 FROM {quote_ident(main)} WHERE record_id = ?", (record_id,)))


def _restore_from_trash(db, main, record_id):
    sql = f"UPDATE {quote_ident(main)} SET deleted_at = NULL WHERE record_id = ? AND deleted_at IS NOT NULL"
    return db.run(sql, (record_id,)).rowcount == 1


def _existing_values(db, main, record_id, columns):
    rows = db.rows(f"SELECT * FROM {quote_ident(main)} WHERE record_id = ?", (record_id,))
    if not rows:
        return None
    return {name: rows[0][name] for name in columns if rows[0].get(name) is not None}


def _store_tables(db, stage, record_id, menu_no, tables, dictionary):
    children, aliases, std_keys = dictionary
    for code, rows in tables:
        if not rows:  # 화면 표가 비어 있으면 DB의 그 표를 지우지 않는다
            continue
        alias = _line_table_alias(children.get(code), stage)
        table = f"{SITE_PREFIX}{stage}_{alias}" if alias else None
        table_columns = db.table_columns(table) if table else []
        if table_columns:
            columns = [c for c in table_columns if c not in LINE_FIXED]
            db.run(f"DELETE FROM {quote_ident(table)} WHERE record_id = ?", (record_id,))
            for number, line in enumerate(rows, 1):
                insert_line(db, table, record_id, number, line, line_values(line, menu_no, aliases, std_keys, columns))
        else:
            _store_child_rows(db, stage, record_id, code, rows)


def _store_child_rows(db, stage, record_id, code, rows):
    table = quote_ident(f"{SITE_PREFIX}{stage}_child")
    db.run(f"DELETE FROM {table} WHERE record_id = ? AND table_code = ?", (record_id, code))
    for number, line in enumerate(rows, 1):
        db.run(f"INSERT INTO {table} (record_id, table_code, line_no, raw_line) VALUES (?, ?, ?, ?)",
               (record_id, code, number, json.dumps(line, ensure_ascii=False)))


def _line_table_alias(child, stage):
    if not child or child["stage"] not in (None, stage):
        return None
    if child["alias"] == "item":
        return "item"
    return child["alias"] if child["typed"] else None


def _trim_captures(db, record_id, screen_code):
    keep = DEFAULT_KEEP
    saved = db.rows("SELECT value FROM settings_shared WHERE key = 'capture_keep'")
    if saved and str(saved[0]["value"]).isdigit():
        keep = max(1, int(saved[0]["value"]))
    db.run("DELETE FROM g2b_capture WHERE record_id = ? AND screen_code = ? AND capture_id NOT IN"
           " (SELECT capture_id FROM g2b_capture WHERE record_id = ? AND screen_code = ?"
           " ORDER BY capture_id DESC LIMIT ?)", (record_id, screen_code, record_id, screen_code, keep))
