import json
import threading

import pytest

from core.errors import BadRequest
from core.gateway import Gateway
from core.tests.support import MENU_NO, capture_fields, count, main_row, point, seed_dictionary, total_rows


def w(gw, fields, request_id):
    return gw.write_capture(fields, request_id)


def table(code, rows):
    return {"id": "g", "dataList": code, "visible": True, "columns": [{"k": "colA", "l": "L"}], "rows": rows}


def test_first_capture_is_new_and_fills_main(seeded):
    res = w(seeded, capture_fields(), "r1")
    assert res["status"] == "new" and res["record_id"] == "V1" and res["stage"] == "bid" and res["changed"] == []
    row = main_row(seeded)
    assert row["keyA"] == "V1" and row["keyB"] == "V1" and row["key1"] == "V1" and row["key2"] is None
    assert row["screen_code"] == MENU_NO and row["store_version"] == 1 and row["user_values"] == "{}"


def test_same_raw_twice_gives_one_capture(seeded):
    cap = capture_fields()
    w(seeded, cap, "r1")
    res = w(seeded, cap, "r2")
    assert res["status"] == "same" and count(seeded, "g2b_capture") == 1
    assert main_row(seeded)["store_version"] == 1


def test_new_hash_same_key_gives_two_captures_one_main(seeded):
    w(seeded, capture_fields(key_b="V1"), "r1")
    res = w(seeded, capture_fields(key_b="V2"), "r2")
    assert count(seeded, "g2b_capture") == 2 and count(seeded, "g2b_bid") == 1
    assert res["status"] == "changed" and res["changed"] == ["keyB"]
    assert main_row(seeded)["keyB"] == "V2" and main_row(seeded)["store_version"] == 2


def test_blank_screen_value_keeps_db_value(seeded):
    w(seeded, capture_fields(key_b="V1"), "r1")
    res = w(seeded, capture_fields(key_b=""), "r2")
    assert main_row(seeded)["keyB"] == "V1" and res["changed"] == []


def test_zero_like_text_is_stored_as_typed(seeded):
    w(seeded, capture_fields(key_b="00"), "r1")
    assert main_row(seeded)["keyB"] == "00"
    w(seeded, capture_fields(key_b="false"), "r2")
    assert main_row(seeded)["keyB"] == "false"


def test_same_request_id_returns_same_response_and_one_capture(seeded):
    cap = capture_fields()
    assert w(seeded, cap, "r1") == w(seeded, cap, "r1")
    assert count(seeded, "g2b_capture") == 1 and main_row(seeded)["store_version"] == 1


def test_same_request_id_replay_ignores_later_body(seeded):
    first = w(seeded, capture_fields(key_b="V1"), "r1")
    assert w(seeded, capture_fields(key_b="V2"), "r1") == first
    assert count(seeded, "g2b_capture") == 1


def test_screen_without_stage_is_rejected_and_writes_nothing(gw):
    seed_dictionary(gw, stage=None)
    before = total_rows(gw)
    res = w(gw, capture_fields(), "r1")
    assert res["status"] == "rejected" and res["reason"] and res["record_id"] is None
    assert total_rows(gw) == before


def test_unknown_screen_is_rejected_and_not_auto_registered(seeded):
    before = total_rows(seeded)
    fields = capture_fields()
    fields["menu_no"] = "M9999"
    assert w(seeded, fields, "r1")["status"] == "rejected"
    assert total_rows(seeded) == before


def test_empty_business_key_is_rejected(seeded):
    before = total_rows(seeded)
    res = w(seeded, capture_fields(key_a=""), "r1")
    assert res["status"] == "rejected" and "업무키" in res["reason"]
    assert total_rows(seeded) == before


def test_bar_in_business_key_is_rejected(seeded):
    assert w(seeded, capture_fields(key_a="A|B"), "r1")["status"] == "rejected"
    assert count(seeded, "g2b_bid") == 0


def test_two_key_fields_make_composite_record_id(gw):
    seed_dictionary(gw, key_fields=("keyA", "keyB"))
    res = w(gw, capture_fields(key_a="N1", key_b="00"), "r1")
    assert res["record_id"] == "N1|00"
    row = main_row(gw)
    assert (row["key1"], row["key2"]) == ("N1", "00")


def test_unknown_keys_are_counted(seeded):
    res = w(seeded, capture_fields(points=[point("dmZ.zzz", "V9")], tables=[]), "r1")
    assert res["unknown_keys"] == 2  # param.paramA, dmZ.zzz


def test_invalid_payload_is_bad_request(seeded):
    with pytest.raises(BadRequest):
        w(seeded, {"site": "g2b"}, "r1")
    broken = capture_fields()
    broken["raw"]["pointInfo"] = "x"
    with pytest.raises(BadRequest):
        w(seeded, broken, "r1")


def test_concurrent_double_click_keeps_one_capture(tmp_path):
    first = Gateway(tmp_path / "h.db")
    seed_dictionary(first)
    second = Gateway(tmp_path / "h.db")
    results = []

    def click(gateway, request_id):
        results.append(w(gateway, capture_fields(), request_id)["status"])

    threads = [threading.Thread(target=click, args=(g, f"r{i}")) for i, g in enumerate((first, second))]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(results) == ["new", "same"] and count(first, "g2b_capture") == 1
    first.close()
    second.close()


def add_item_dictionary(gw):
    gw.add_records("dict_child", [{"fields": {"site": "g2b", "table_code": "dlA", "alias": "item", "stage": "bid"}}])
    gw.add_records("dict_key", [{"fields": {"std_key": "keyL", "stages": ["bid_item"], "as_column": 1}}])
    gw.add_records("dict_alias", [{"fields": {"site": "g2b", "screen_code": "", "source_key": "colA",
                                              "std_key": "keyL"}}])


def test_item_rows_use_item_table_with_std_columns(seeded):
    add_item_dictionary(seeded)
    w(seeded, capture_fields(tables=[table("dlA", [{"colA": "X1"}, {"colA": "X2"}])]), "r1")
    rows = seeded.rows("SELECT record_id, line_no, raw_line, keyL FROM g2b_bid_item ORDER BY line_no")
    assert [(r["record_id"], r["line_no"], r["keyL"]) for r in rows] == [("V1", 1, "X1"), ("V1", 2, "X2")]
    assert json.loads(rows[0]["raw_line"]) == {"colA": "X1"}
    assert count(seeded, "g2b_bid_child") == 0


def test_item_rows_are_replaced_and_kept_when_screen_table_is_empty(seeded):
    add_item_dictionary(seeded)
    w(seeded, capture_fields(key_b="V1", tables=[table("dlA", [{"colA": "X1"}, {"colA": "X2"}])]), "r1")
    w(seeded, capture_fields(key_b="V2", tables=[table("dlA", [{"colA": "X3"}])]), "r2")
    assert [r["keyL"] for r in seeded.rows("SELECT keyL FROM g2b_bid_item")] == ["X3"]
    w(seeded, capture_fields(key_b="V3", tables=[table("dlA", [])]), "r3")
    assert count(seeded, "g2b_bid_item") == 1


def test_child_rows_replaced_per_table_code_and_kept_when_empty(seeded):
    two = [table("dlX", [{"colA": "X1"}]), table("dlY", [{"colA": "Y1"}, {"colA": "Y2"}])]
    w(seeded, capture_fields(key_b="V1", tables=two), "r1")
    w(seeded, capture_fields(key_b="V2", tables=[table("dlX", [{"colA": "X9"}]), table("dlY", [])]), "r2")
    rows = seeded.rows("SELECT table_code, line_no, raw_line FROM g2b_bid_child ORDER BY table_code, line_no")
    assert [(r["table_code"], json.loads(r["raw_line"])["colA"]) for r in rows] == \
        [("dlX", "X9"), ("dlY", "Y1"), ("dlY", "Y2")]


def test_capture_keep_trims_to_five_per_record(seeded):
    for n in range(7):
        w(seeded, capture_fields(key_b=f"V{n}"), f"r{n}")
    assert count(seeded, "g2b_capture") == 5
    newest = seeded.rows("SELECT MAX(capture_id) AS n FROM g2b_capture")[0]["n"]
    assert main_row(seeded)["latest_capture_id"] == newest


def test_capture_keep_is_a_setting(seeded):
    seeded.run("INSERT INTO settings_shared (key, value) VALUES ('capture_keep', '2')")
    for n in range(4):
        w(seeded, capture_fields(key_b=f"V{n}"), f"r{n}")
    assert count(seeded, "g2b_capture") == 2


def test_capture_row_stores_canonical_raw_and_screen(seeded):
    w(seeded, capture_fields(), "r1")
    row = seeded.rows("SELECT * FROM g2b_capture")[0]
    assert row["record_id"] == "V1" and row["screen_code"] == MENU_NO and row["raw_hash"]
    assert json.loads(row["raw"])["pointInfo"][0]["k"] == "dmA.keyA"
