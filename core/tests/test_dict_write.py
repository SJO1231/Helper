import pytest

from core.errors import BadRequest, NotFound, NotWritable
from core.tests.support import count

REQ = {"require": {"site": "g2b", "menu_no": "M1"},
       "fields": {"scrn_no": "S1", "menu_cang_val": "C1", "name": "N"}}


def screens(gw):
    return gw.rows("SELECT site, menu_no, scrn_no, name, stage FROM dict_screen")


def test_put_dict_screen_twice_with_noupdate_keeps_one_row(gw):
    first = gw.upsert_records("dict_screen", [REQ], noupdate=True)
    renamed = {**REQ, "fields": {**REQ["fields"], "name": "N2"}}
    second = gw.upsert_records("dict_screen", [renamed], noupdate=True)
    assert screens(gw) == [{"site": "g2b", "menu_no": "M1", "scrn_no": "S1", "name": "N", "stage": None}]
    assert first == second


def test_put_without_noupdate_updates_stage(gw):
    gw.upsert_records("dict_screen", [REQ], noupdate=False)
    gw.upsert_records("dict_screen", [{**REQ, "fields": {"stage": "bid"}}], noupdate=False)
    assert screens(gw)[0]["stage"] == "bid" and screens(gw)[0]["name"] == "N"


def test_write_to_main_table_is_refused(gw):
    with pytest.raises(NotWritable):
        gw.add_records("g2b_bid", [{"fields": {}}])
    with pytest.raises(NotWritable):
        gw.upsert_records("g2b_capture", [REQ], noupdate=False)


def test_unknown_table_is_not_found(gw):
    with pytest.raises(NotFound):
        gw.require_table("nope")


def test_dict_key_stages_stored_as_json_list(gw):
    gw.add_records("dict_key", [{"fields": {"std_key": "keyA", "stages": ["bid", "bid_item"]}}])
    stored = gw.rows("SELECT stages FROM dict_key")[0]["stages"]
    assert stored == '["bid", "bid_item"]' or stored == '["bid","bid_item"]'
    assert gw.list_records("dict_key", None, None)[0][0]["fields"]["stages"] == ["bid", "bid_item"]


def test_add_returns_id_and_fields(gw):
    out = gw.add_records("dict_code", [{"fields": {"std_key": "keyA", "code": "1", "meaning": "M"}}])
    assert out[0]["id"] and out[0]["fields"]["meaning"] == "M"


def test_update_by_id_changes_only_given_fields(gw):
    row_id = gw.upsert_records("dict_screen", [REQ], noupdate=False)[0]["id"]
    assert gw.update_records("dict_screen", [{"id": row_id, "fields": {"name": "N3"}}]) == [{"id": row_id}]
    assert screens(gw)[0]["name"] == "N3" and screens(gw)[0]["scrn_no"] == "S1"


def test_update_missing_id_is_not_found(gw):
    with pytest.raises(NotFound):
        gw.update_records("dict_screen", [{"id": 999, "fields": {"name": "N"}}])


def test_unknown_field_is_rejected(gw):
    with pytest.raises(BadRequest):
        gw.add_records("dict_code", [{"fields": {"std_key": "keyA", "bogus": "x"}}])


@pytest.mark.parametrize("fields", [
    {"std_key": "keyA", "stages": ["nowhere"]},
    {"std_key": "keyA", "stages": "bid"},
    {"std_key": "keyA", "type": "weird"},
    {"std_key": "bad name"},
    {"std_key": "record_id"},
    {"std_key": "keyA", "as_column": 2},
])
def test_invalid_dict_key_is_rejected_and_writes_nothing(gw, fields):
    with pytest.raises(BadRequest):
        gw.add_records("dict_key", [{"fields": fields}])
    assert count(gw, "dict_key") == 0


def test_invalid_stage_in_screen_is_rejected(gw):
    with pytest.raises(BadRequest):
        gw.upsert_records("dict_screen", [{**REQ, "fields": {"stage": "other"}}], noupdate=False)


def test_batch_is_all_or_nothing(gw):
    good = {"fields": {"std_key": "keyA", "stages": ["bid"]}}
    bad = {"fields": {"std_key": "keyB", "stages": ["nowhere"]}}
    with pytest.raises(BadRequest):
        gw.add_records("dict_key", [good, bad])
    assert count(gw, "dict_key") == 0


def test_alias_null_screen_code_is_stored_as_global(gw):
    fields = {"site": "g2b", "screen_code": None, "source_key": "dmX.k", "std_key": "keyA"}
    gw.add_records("dict_alias", [{"fields": fields}])
    assert gw.rows("SELECT screen_code FROM dict_alias") == [{"screen_code": ""}]


def test_same_request_id_replays_saved_response(gw):
    first = gw.add_records("dict_code", [{"fields": {"std_key": "keyA", "code": "1", "meaning": "M"}}], "r1")
    again = gw.add_records("dict_code", [{"fields": {"std_key": "keyA", "code": "1", "meaning": "M"}}], "r1")
    assert first == again and count(gw, "dict_code") == 1


def test_label_change_rebuilds_public_view_column_names(seeded):
    site = {"scope": "site", "scope_id": "g2b", "key": "keyA", "label": "SiteA"}
    seeded.add_records("dict_label", [{"fields": site}])
    names = [r["name"] for r in seeded.rows('PRAGMA table_info("v_bid")')]
    assert "SiteA" in names and "keyA" not in names
    seeded.add_records("dict_label", [{"fields": {"scope": "user", "scope_id": "", "key": "keyA", "label": "UserA"}}])
    assert "UserA" not in [r["name"] for r in seeded.rows('PRAGMA table_info("v_bid")')]


def test_dict_columns_mark_only_primary_key_columns(seeded):
    primary = {c["id"] for c in seeded.list_columns("dict_alias") if c["fields"].get("primary")}
    assert primary == {"site", "screen_code", "source_key"}
    other = seeded.list_columns("dict_key")
    assert [c["id"] for c in other if c["fields"].get("primary")] == ["std_key"]


def test_non_dict_columns_have_no_primary_field(seeded):
    assert all("primary" not in c["fields"] for c in seeded.list_columns("g2b_capture"))
