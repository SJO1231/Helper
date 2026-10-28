import pytest

from core.errors import BadRequest, NotFound
from core.tests.support import insert_main


def ids(gw, sort=None, flt=None, limit=500, offset=0, table="g2b_bid"):
    records, total = gw.list_records(table, sort, flt, limit, offset)
    return [r["id"] for r in records], total


def test_money_sorts_numerically_with_commas(seeded):
    insert_main(seeded, "g2b_bid", [{"record_id": "a", "keyB": "1,000"}, {"record_id": "b", "keyB": "200"},
                                    {"record_id": "c", "keyB": "30"}])
    assert ids(seeded, "keyB")[0] == ["c", "b", "a"]
    assert ids(seeded, "-keyB")[0] == ["a", "b", "c"]


@pytest.mark.parametrize("sort,expect", [("keyB", ["d", "a", "c"]), ("-keyB", ["a", "d", "c"])])
def test_blank_sorts_last_both_directions(seeded, sort, expect):
    insert_main(seeded, "g2b_bid", [{"record_id": "a", "keyB": "1,000"}, {"record_id": "b", "keyB": ""},
                                    {"record_id": "c", "keyB": "-"}, {"record_id": "d", "keyB": "200"},
                                    {"record_id": "e", "keyB": None}])
    got = ids(seeded, sort)[0]
    assert got[:2] == expect[:2] and set(got[2:]) == {"b", "c", "e"}


def test_date_sorts_by_digits_only(seeded):
    seeded.add_records("dict_key", [{"fields": {"std_key": "keyD", "type": "date", "stages": ["bid"],
                                                "as_column": 1}}])
    insert_main(seeded, "g2b_bid", [{"record_id": "a", "keyD": "2026.03.04"}, {"record_id": "b", "keyD": "20251231"},
                                    {"record_id": "c", "keyD": "2026-01-02 10:00"}])
    assert ids(seeded, "keyD")[0] == ["b", "c", "a"]


def test_text_sort_and_multiple_keys(seeded):
    insert_main(seeded, "g2b_bid", [{"record_id": "a", "keyA": "x", "keyB": "2"},
                                    {"record_id": "b", "keyA": "x", "keyB": "1"},
                                    {"record_id": "c", "keyA": "w", "keyB": "9"}])
    assert ids(seeded, "keyA,-keyB")[0] == ["c", "a", "b"]


def test_filter_matches_any_listed_value(seeded):
    insert_main(seeded, "g2b_bid", [{"record_id": r, "keyB": v} for r, v in
                                    [("a", "V1"), ("b", "V2"), ("c", "V3"), ("d", None)]])
    assert ids(seeded, "record_id", {"keyB": ["V1", "V3"]})[0] == ["a", "c"]
    assert ids(seeded, "record_id", {"keyB": [""]})[0] == ["d"]
    assert ids(seeded, "record_id", {"keyB": []})[0] == []


def test_records_total_ignores_limit_and_offset(seeded):
    insert_main(seeded, "g2b_bid", [{"record_id": f"r{n:02d}"} for n in range(12)])
    got, total = ids(seeded, "record_id", limit=5, offset=10)
    assert total == 12 and got == ["r10", "r11"]


def test_limit_is_capped_and_defaults_to_500(seeded):
    insert_main(seeded, "g2b_bid", [{"record_id": f"r{n}"} for n in range(600)])
    assert len(ids(seeded)[0]) == 500
    assert len(ids(seeded, limit=10**6)[0]) == 600


def test_deleted_rows_hidden_and_restorable(seeded):
    insert_main(seeded, "g2b_bid", [{"record_id": "a"}, {"record_id": "b"}])
    assert seeded.trash_record("g2b_bid", "a") is True
    assert ids(seeded, "record_id") == (["b"], 1)
    assert seeded.restore_record("g2b_bid", "a") is True
    assert ids(seeded, "record_id") == (["a", "b"], 2)
    assert seeded.trash_record("g2b_bid", "nope") is False


def test_paging_is_stable_without_sort(seeded):
    insert_main(seeded, "g2b_bid", [{"record_id": f"r{n:02d}"} for n in range(6)])
    assert ids(seeded, limit=3)[0] + ids(seeded, limit=3, offset=3)[0] == [f"r{n:02d}" for n in range(6)]


@pytest.mark.parametrize("kwargs", [{"sort": "nope"}, {"flt": {"nope": ["x"]}}, {"limit": -1}, {"offset": -1},
                                    {"sort": 'keyA"; drop'}])
def test_bad_query_is_bad_request(seeded, kwargs):
    with pytest.raises(BadRequest):
        ids(seeded, **kwargs)


def test_unknown_table_is_not_found(seeded):
    with pytest.raises(NotFound):
        ids(seeded, table="nope")
    with pytest.raises(NotFound):
        seeded.list_columns("nope")


def test_main_records_use_row_key_as_id_and_have_all_columns(seeded):
    insert_main(seeded, "g2b_bid", [{"record_id": "a", "keyA": "V1"}])
    record = seeded.list_records("g2b_bid", None, None)[0][0]
    assert record["id"] == "a" and record["fields"]["keyA"] == "V1" and "deleted_at" in record["fields"]


def test_list_columns_follow_dictionary_and_label_priority(seeded):
    cols = seeded.list_columns("g2b_bid")
    assert [c["id"] for c in cols] == ["keyA", "keyB"]
    assert cols[1]["fields"] == {"label": "keyB", "type": "money", "index": False}
    for scope, scope_id, label in [("system", "", "sys"), ("site", "g2b", "site"), ("user", "", "usr")]:
        seeded.add_records("dict_label", [{"fields": {"scope": scope, "scope_id": scope_id, "key": "keyB",
                                                      "label": label}}])
        assert seeded.list_columns("g2b_bid")[1]["fields"]["label"] == label


def test_list_columns_of_item_table_use_item_stage(seeded):
    seeded.add_records("dict_key", [{"fields": {"std_key": "keyL", "stages": ["bid_item"], "as_column": 1}}])
    assert [c["id"] for c in seeded.list_columns("g2b_bid_item")] == ["keyL"]


def test_list_tables_has_kinds_and_stage(seeded):
    tables = {t["id"]: t["fields"] for t in seeded.list_tables()}
    assert tables["g2b_capture"]["kind"] == "capture"
    assert tables["g2b_bid"] == {"label": "g2b_bid", "stage": "bid", "kind": "main"}
    assert tables["g2b_bid_item"]["kind"] == "item" and tables["g2b_bid_child"]["kind"] == "child"
    assert tables["dict_key"]["kind"] == "dict"
    assert "request_log" not in tables and "settings_shared" not in tables
