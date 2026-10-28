from core.flatten import flatten
from core.merge import merge_main
from core.rawhash import raw_hash
from core.record_key import build_record_id


def test_raw_hash_ignores_key_order():
    assert raw_hash({"a": 1, "b": 2}) == raw_hash({"b": 2, "a": 1})


def test_raw_hash_changes_with_value():
    assert raw_hash({"a": "1"}) != raw_hash({"a": "2"})


def test_record_id_joins_key_fields_with_bar():
    assert build_record_id({"n": "N1", "o": "00"}, ["n", "o"])[0] == "N1|00"


def test_record_id_single_key_has_no_tail():
    assert build_record_id({"n": "N1"}, ["n"]) == ("N1", None)


def test_record_id_empty_key_rejected():
    record_id, reason = build_record_id({"n": ""}, ["n"])
    assert record_id is None and reason


def test_record_id_missing_key_rejected():
    assert build_record_id({}, ["n"])[0] is None


def test_record_id_bar_in_value_rejected():
    assert build_record_id({"n": "A|B"}, ["n"])[0] is None


def test_merge_blank_incoming_keeps_existing():
    assert merge_main({"a": "1", "b": "2"}, {"a": "", "b": "3"}) == ({"a": "1", "b": "3"}, ["b"])


def test_merge_keeps_zero_and_false_text():
    merged, changed = merge_main({}, {"a": "0", "b": "false", "c": "00"})
    assert merged == {"a": "0", "b": "false", "c": "00"} and changed == ["a", "b", "c"]


def test_merge_same_value_is_not_a_change():
    assert merge_main({"a": "1"}, {"a": "1"}) == ({"a": "1"}, [])


def test_flatten_counts_unknown_and_maps_param():
    raw = {
        "state": {},
        "param": {"keyB": "P1", "other": "P2"},
        "pointInfo": [
            {"k": "dmA.keyA", "v": "V1", "l": "L", "visible": True},
            {"k": "dmZ.x", "v": "V2", "l": "L", "visible": True},
        ],
        "tables": [],
    }
    flat = flatten(raw, "S1", [], {"keyA", "keyB"})
    assert flat.values == {"keyA": "V1", "keyB": "P1"}
    assert flat.unknown_keys == 2  # dmZ.x, param.other


def test_flatten_keeps_original_text_of_values():
    raw = {"state": {}, "param": {}, "tables": [], "pointInfo": [
        {"k": "keyA", "v": "00", "l": "L", "visible": True},
        {"k": "keyB", "v": 0, "l": "L", "visible": True},
        {"k": "keyC", "v": False, "l": "L", "visible": True},
        {"k": "keyD", "v": None, "l": "L", "visible": True},
    ]}
    flat = flatten(raw, "S1", [], {"keyA", "keyB", "keyC", "keyD"})
    assert flat.values == {"keyA": "00", "keyB": "0", "keyC": "false", "keyD": ""}


def test_flatten_first_non_empty_value_wins():
    raw = {"state": {}, "param": {}, "tables": [], "pointInfo": [
        {"k": "a.keyA", "v": "", "l": "L", "visible": True},
        {"k": "b.keyA", "v": "V1", "l": "L", "visible": True},
        {"k": "c.keyA", "v": "V2", "l": "L", "visible": True},
    ]}
    assert flatten(raw, "S1", [], {"keyA"}).values == {"keyA": "V1"}


def test_flatten_returns_tables_as_text_rows():
    raw = {"state": {}, "param": {}, "pointInfo": [], "tables": [
        {"id": "g", "dataList": "dlA", "visible": True, "columns": [{"k": "colA", "l": "L"}],
         "rows": [{"colA": 1}, {"colA": None}]},
    ]}
    flat = flatten(raw, "S1", [], set())
    assert flat.tables == [("dlA", [{"colA": "1"}, {"colA": ""}])]
    assert flat.unknown_keys == 1
