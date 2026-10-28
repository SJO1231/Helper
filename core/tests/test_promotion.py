import json

import pytest

from core.errors import BadRequest, StorageError
from core.tests.support import capture_fields, column_names, count, main_row, point


def collect_with(gw, **extra):
    points = [point(f"dmA.{k}", v) for k, v in extra.items()]
    return gw.write_capture(capture_fields(points=points), "r-collect")


def set_key(gw, std_key, **fields):
    gw.upsert_records("dict_key", [{"require": {"std_key": std_key}, "fields": fields}], noupdate=False)


def test_promote_adds_column_and_backfills_from_raw(seeded):
    collect_with(seeded, keyC="V3")
    assert "keyC" not in column_names(seeded, "g2b_bid")
    set_key(seeded, "keyC", as_column=1)
    assert "keyC" in column_names(seeded, "g2b_bid") and main_row(seeded)["keyC"] == "V3"


def test_promote_through_update_by_id_also_works(seeded):
    collect_with(seeded, keyC="V3")
    row_id = seeded.rows("SELECT rowid AS id FROM dict_key WHERE std_key='keyC'")[0]["id"]
    seeded.update_records("dict_key", [{"id": row_id, "fields": {"as_column": 1}}])
    assert main_row(seeded)["keyC"] == "V3"


def test_promote_new_key_added_with_as_column(seeded):
    collect_with(seeded, keyN="V4")
    seeded.add_records("dict_key", [{"fields": {"std_key": "keyN", "stages": ["bid"], "as_column": 1}}])
    assert main_row(seeded)["keyN"] == "V4"


def test_promote_only_touches_listed_stages(seeded):
    set_key(seeded, "keyC", as_column=1)
    assert "keyC" in column_names(seeded, "g2b_bid")
    assert "keyC" not in column_names(seeded, "g2b_receipt")


def test_promote_to_another_stage_adds_column_there(seeded):
    set_key(seeded, "keyC", as_column=1, stages=["bid", "contract"])
    assert "keyC" in column_names(seeded, "g2b_contract")
    set_key(seeded, "keyC", stages=["bid"])
    assert "keyC" not in column_names(seeded, "g2b_contract") and "keyC" in column_names(seeded, "g2b_bid")


def test_promote_is_idempotent(seeded):
    set_key(seeded, "keyC", as_column=1)
    set_key(seeded, "keyC", as_column=1)
    assert column_names(seeded, "g2b_bid").count("keyC") == 1


def test_demote_drops_column_and_raw_keeps_value(seeded):
    collect_with(seeded, keyC="V3")
    set_key(seeded, "keyC", as_column=1)
    set_key(seeded, "keyC", as_column=0)
    assert "keyC" not in column_names(seeded, "g2b_bid")
    raw = json.loads(seeded.rows("SELECT raw FROM g2b_capture")[0]["raw"])
    assert {"k": "dmA.keyC", "v": "V3", "l": "L", "visible": True} in raw["pointInfo"]


def test_failed_backfill_rolls_back_column_and_dictionary(seeded):
    collect_with(seeded, keyC="V3")
    seeded.run("UPDATE g2b_capture SET raw = '{broken'")
    with pytest.raises(StorageError):
        set_key(seeded, "keyC", as_column=1)
    assert "keyC" not in column_names(seeded, "g2b_bid")
    assert seeded.rows("SELECT as_column FROM dict_key WHERE std_key='keyC'") == [{"as_column": 0}]


def test_index_flag_creates_and_drops_index(seeded):
    set_key(seeded, "keyC", as_column=1, index=1)
    names = {r["name"] for r in seeded.rows("SELECT name FROM sqlite_master WHERE type='index'")}
    assert "ix_g2b_bid_keyC" in names
    set_key(seeded, "keyC", index=0)
    names = {r["name"] for r in seeded.rows("SELECT name FROM sqlite_master WHERE type='index'")}
    assert "ix_g2b_bid_keyC" not in names
    set_key(seeded, "keyC", index=1)
    set_key(seeded, "keyC", as_column=0)
    assert "keyC" not in column_names(seeded, "g2b_bid")


def test_view_follows_promotion(seeded):
    set_key(seeded, "keyC", as_column=1)
    assert "keyC" in [r["name"] for r in seeded.rows('PRAGMA table_info("v_bid")')]
    set_key(seeded, "keyC", as_column=0)
    assert "keyC" not in [r["name"] for r in seeded.rows('PRAGMA table_info("v_bid")')]


def test_item_table_column_is_backfilled_from_line_raw(seeded):
    child = {"site": "g2b", "table_code": "dlA", "alias": "item", "stage": "bid"}
    seeded.add_records("dict_child", [{"fields": child}])
    rows = [{"colA": "X1"}, {"colA": "X2"}]
    table = {"id": "g", "dataList": "dlA", "visible": True, "columns": [{"k": "colA", "l": "L"}], "rows": rows}
    seeded.write_capture(capture_fields(tables=[table]), "r1")
    seeded.add_records("dict_alias", [{"fields": {"site": "g2b", "screen_code": "", "source_key": "colA",
                                                  "std_key": "keyL"}}])
    seeded.add_records("dict_key", [{"fields": {"std_key": "keyL", "stages": ["bid_item"], "as_column": 1}}])
    assert [r["keyL"] for r in seeded.rows("SELECT keyL FROM g2b_bid_item ORDER BY line_no")] == ["X1", "X2"]


def child_table(rows):
    return {"id": "g", "dataList": "dlX", "visible": True, "columns": [{"k": "colA", "l": "L"}], "rows": rows}


def child_count(gw, code):
    return gw.rows("SELECT COUNT(*) AS n FROM g2b_bid_child WHERE table_code=?", (code,))[0]["n"]


def test_child_typed_moves_rows_to_own_table_and_back(seeded):
    seeded.add_records("dict_child", [{"fields": {"site": "g2b", "table_code": "dlX", "alias": "party",
                                                  "stage": "bid", "typed": 0}}])
    seeded.write_capture(capture_fields(tables=[child_table([{"colA": "X1"}, {"colA": "X2"}])]), "r1")
    assert child_count(seeded, "dlX") == 2
    seeded.add_records("dict_alias", [{"fields": {"site": "g2b", "screen_code": "", "source_key": "colA",
                                                  "std_key": "keyP"}}])
    seeded.add_records("dict_key", [{"fields": {"std_key": "keyP", "stages": ["bid_party"], "as_column": 1}}])

    seeded.upsert_records("dict_child", [{"require": {"table_code": "dlX"}, "fields": {"typed": 1}}], False)
    assert count(seeded, "g2b_bid_party") == 2 and child_count(seeded, "dlX") == 0
    assert [r["keyP"] for r in seeded.rows("SELECT keyP FROM g2b_bid_party ORDER BY line_no")] == ["X1", "X2"]

    seeded.write_capture(capture_fields(key_b="V2", tables=[child_table([{"colA": "X3"}])]), "r2")
    assert count(seeded, "g2b_bid_party") == 1

    seeded.upsert_records("dict_child", [{"require": {"table_code": "dlX"}, "fields": {"typed": 0}}], False)
    assert child_count(seeded, "dlX") == 1
    assert not seeded.table_columns("g2b_bid_party")


def test_typed_child_needs_stage_and_plain_alias(seeded):
    with pytest.raises(BadRequest):
        seeded.add_records("dict_child", [{"fields": {"site": "g2b", "table_code": "dlX", "alias": "party",
                                                      "typed": 1}}])
    with pytest.raises(BadRequest):
        seeded.add_records("dict_child", [{"fields": {"site": "g2b", "table_code": "dlX", "alias": "child",
                                                      "stage": "bid", "typed": 1}}])
    assert count(seeded, "dict_child") == 0
