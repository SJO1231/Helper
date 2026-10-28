"""수집 이력(g2b_capture)을 뷰어가 읽기 전용 목록으로 보는 길. 값은 A1 같은 자리표시뿐이다."""
import pytest

from core.routes import handle
from core.tests.support import capture_fields

HEADERS = {"x-schema-version": "1", "x-request-id": "r1"}
CAPTURE_PATH = "/api/tables/g2b_capture/records"
SIX_COLUMNS = ["capture_id", "record_id", "screen_code", "url", "captured_at", "raw_hash"]
SIX_LABELS = ["수집번호", "업무키", "화면", "주소", "수집시각", "해시"]


def add_captures(gw, stamps):
    with gw.tx():
        for number, stamp in enumerate(stamps):
            gw.run("INSERT INTO g2b_capture (record_id, screen_code, url, captured_at, raw_hash, raw)"
                   " VALUES (?, ?, ?, ?, ?, ?)", ("A1", "screen-x", "url-x", stamp, f"hash-{number}", "{}"))


def test_tables_lists_capture_with_korean_label(seeded):
    tables = {t["id"]: t["fields"] for t in seeded.list_tables()}
    assert tables["g2b_capture"] == {"label": "수집 이력", "stage": None, "kind": "capture"}


def test_other_table_labels_are_unchanged(seeded):
    tables = {t["id"]: t["fields"]["label"] for t in seeded.list_tables()}
    assert tables["g2b_bid"] == "g2b_bid" and tables["dict_key"] == "dict_key"


def test_capture_columns_are_six_in_order_without_raw(seeded):
    columns = seeded.list_columns("g2b_capture")
    assert [c["id"] for c in columns] == SIX_COLUMNS
    assert [c["fields"]["label"] for c in columns] == SIX_LABELS
    assert all(c["fields"]["type"] == "text" and c["fields"]["index"] is False for c in columns)


def test_capture_records_default_to_newest_first(seeded):
    add_captures(seeded, ["2026-01-02", "2026-01-03", "2026-01-01"])
    records, total = seeded.list_records("g2b_capture", None, None)
    assert total == 3
    assert [r["fields"]["captured_at"] for r in records] == ["2026-01-03", "2026-01-02", "2026-01-01"]


def test_capture_records_break_ties_by_newest_capture_id(seeded):
    add_captures(seeded, ["2026-01-02", "2026-01-02", "2026-01-02"])
    records, _ = seeded.list_records("g2b_capture", None, None)
    assert [r["id"] for r in records] == [3, 2, 1]


def test_capture_records_leave_out_raw_but_keep_the_six(seeded):
    add_captures(seeded, ["2026-01-01"])
    fields = seeded.list_records("g2b_capture", None, None)[0][0]["fields"]
    assert "raw" not in fields and all(name in fields for name in SIX_COLUMNS)


def test_explicit_sort_overrides_capture_default(seeded):
    add_captures(seeded, ["2026-01-02", "2026-01-03", "2026-01-01"])
    records, _ = seeded.list_records("g2b_capture", "captured_at", None)
    assert [r["fields"]["captured_at"] for r in records] == ["2026-01-01", "2026-01-02", "2026-01-03"]


def test_capture_paging_follows_the_newest_first_order(seeded):
    add_captures(seeded, [f"2026-01-0{n}" for n in range(1, 7)])
    first = seeded.list_records("g2b_capture", None, None, 3, 0)[0]
    second = seeded.list_records("g2b_capture", None, None, 3, 3)[0]
    assert [r["id"] for r in first + second] == [6, 5, 4, 3, 2, 1]


def test_other_tables_keep_their_default_order(seeded):
    with seeded.tx():
        for record_id in ("b", "a", "c"):
            seeded.run("INSERT INTO g2b_bid (record_id) VALUES (?)", (record_id,))
    records, _ = seeded.list_records("g2b_bid", None, None)
    assert [r["id"] for r in records] == ["b", "a", "c"]


@pytest.mark.parametrize("method", ["PATCH", "PUT", "DELETE"])
def test_capture_list_is_not_writable_except_by_collecting(seeded, method):
    status, body = handle(seeded, method, CAPTURE_PATH, HEADERS, {"records": []})
    assert status == 405 and set(body) == {"error"}


def test_post_to_capture_is_still_the_collect_path(seeded):
    status, body = handle(seeded, "POST", CAPTURE_PATH, HEADERS, {"records": [{"fields": capture_fields()}]})
    assert status == 200 and body["records"][0]["fields"]["status"] in ("new", "rejected")
