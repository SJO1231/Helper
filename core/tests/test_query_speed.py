import time

from core.tests.support import insert_main


def test_page_of_500_from_10000_rows_under_1s(seeded):
    insert_main(seeded, "g2b_bid", [{"record_id": f"r{n:05d}", "keyA": f"A{n}", "keyB": f"{n * 7 % 1000:,}"}
                                    for n in range(10_000)])
    started = time.perf_counter()
    records, total = seeded.list_records("g2b_bid", "-keyB", None, 500, 9000)
    elapsed = time.perf_counter() - started
    assert total == 10_000 and len(records) == 500
    assert elapsed < 1.0, f"{elapsed:.3f}초"
