import re

import pytest

from core import backup
from core.gateway import Gateway
from core.tests.support import count


def add_code(gw, code):
    gw.add_records("dict_code", [{"fields": {"std_key": "keyA", "code": code, "meaning": "M"}}])


@pytest.fixture
def live_db(tmp_path):
    path = tmp_path / "live.db"
    gw = Gateway(path)
    add_code(gw, "1")
    gw.close()
    return path


def make_backup(live_db, capsys):
    assert backup.main(["make", "--db", str(live_db)]) == 0
    out = capsys.readouterr().out
    return live_db.parent / "backups" / re.search(r"helper-\d{8}-\d{6}\.sqlite", out).group(0), out


def rows_in(path, table="dict_code"):
    gw = Gateway(path)
    try:
        return count(gw, table)
    finally:
        gw.close()


def test_make_writes_timestamped_file_and_prints_main_table_counts(live_db, capsys):
    made, out = make_backup(live_db, capsys)
    assert made.exists()
    for table in ("g2b_receipt", "g2b_bid", "g2b_contract"):
        assert f"{table}: 0" in out


def test_make_refuses_missing_db_without_creating_it(tmp_path, capsys):
    missing = tmp_path / "none.db"
    assert backup.main(["make", "--db", str(missing)]) == 1
    assert not missing.exists()


def test_restore_returns_row_count_to_backup_time(live_db, capsys):
    made, _ = make_backup(live_db, capsys)
    gw = Gateway(live_db)
    add_code(gw, "2")
    gw.close()
    assert rows_in(live_db) == 2
    assert backup.main(["restore", str(made), "--db", str(live_db)]) == 0
    assert rows_in(live_db) == 1


def test_restore_keeps_before_restore_copy_of_current_db(live_db, capsys):
    made, _ = make_backup(live_db, capsys)
    gw = Gateway(live_db)
    add_code(gw, "2")
    gw.close()
    backup.main(["restore", str(made), "--db", str(live_db)])
    kept = list((live_db.parent / "backups").glob("helper-before-restore-*.sqlite"))
    assert len(kept) == 1 and rows_in(kept[0]) == 2


def test_restore_reports_ok_integrity_and_tells_to_stop_core_first(live_db, capsys):
    made, _ = make_backup(live_db, capsys)
    capsys.readouterr()
    assert backup.main(["restore", str(made), "--db", str(live_db)]) == 0
    lines = capsys.readouterr().out.splitlines()
    assert "코어를 끄고" in lines[0]
    assert any("integrity_check: ok" in line for line in lines)


def test_restore_rejects_other_schema_version_and_leaves_db_alone(live_db, capsys):
    made, _ = make_backup(live_db, capsys)
    other = Gateway(made)
    other.run("UPDATE schema_version SET version = 99")
    other.close()
    gw = Gateway(live_db)
    add_code(gw, "2")
    gw.close()
    assert backup.main(["restore", str(made), "--db", str(live_db)]) == 1
    assert rows_in(live_db) == 2
    assert not list((live_db.parent / "backups").glob("helper-before-restore-*"))
