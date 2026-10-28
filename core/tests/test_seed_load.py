"""seed 적재 명령 시험. shared/seed/fixtures/ok를 쓴다(값은 자리표시뿐)."""
import json
import shutil
import subprocess
import sys

import pytest

from core.seed_load import SEED_FILES, SeedError, load
from core.tests.support import ROOT, column_names, count

OK = ROOT / "shared" / "seed" / "fixtures" / "ok"
TABLES = [name.removesuffix(".json") for name in SEED_FILES]


def counts(gw):
    return {table: count(gw, table) for table in TABLES}


def copy_seed(tmp_path):
    target = tmp_path / "seed"
    shutil.copytree(OK, target)
    return target


def test_empty_db_gets_exactly_the_file_rows(gw):
    added = load(gw, OK)
    for name in SEED_FILES:
        expected = len(json.loads((OK / name).read_text(encoding="utf-8"))["rows"])
        assert added[name.removesuffix(".json")] == expected == count(gw, name.removesuffix(".json"))


def test_load_twice_keeps_same_counts(gw):
    load(gw, OK)
    first = counts(gw)
    added_again = load(gw, OK)
    assert counts(gw) == first
    assert set(added_again.values()) == {0}


def test_existing_user_label_is_not_overwritten(gw):
    user_row = {"scope": "system", "scope_id": "", "key": "keyA"}
    gw.add_records("dict_label", [{"fields": {**user_row, "label": "USER"}}])
    load(gw, OK)
    rows = gw.rows("SELECT label FROM dict_label WHERE key = 'keyA'")
    assert rows == [{"label": "USER"}]


def test_as_column_keys_get_columns_in_their_stages(gw):
    load(gw, OK)
    assert "keyA" in column_names(gw, "g2b_receipt")


def test_broken_file_loads_nothing(gw, tmp_path):
    seed = copy_seed(tmp_path)
    (seed / "dict_child.json").write_text("{not json", encoding="utf-8")
    with pytest.raises(SeedError):
        load(gw, seed)
    assert set(counts(gw).values()) == {0}


def test_invalid_row_in_late_file_rolls_back_earlier_files(gw, tmp_path):
    seed = copy_seed(tmp_path)
    child = json.loads((seed / "dict_child.json").read_text(encoding="utf-8"))
    child["rows"][0]["stage"] = "not-a-stage"
    (seed / "dict_child.json").write_text(json.dumps(child), encoding="utf-8")
    with pytest.raises(Exception):
        load(gw, seed)
    assert set(counts(gw).values()) == {0}


def test_missing_file_is_rejected(gw, tmp_path):
    seed = copy_seed(tmp_path)
    (seed / "dict_code.json").unlink()
    with pytest.raises(SeedError):
        load(gw, seed)
    assert set(counts(gw).values()) == {0}


def test_row_without_key_field_is_rejected(gw, tmp_path):
    seed = copy_seed(tmp_path)
    (seed / "dict_label.json").write_text(json.dumps({"rows": [{"label": "V1"}]}), encoding="utf-8")
    with pytest.raises(SeedError):
        load(gw, seed)
    assert set(counts(gw).values()) == {0}


def test_reference_folder_is_ignored(gw, tmp_path):
    seed = copy_seed(tmp_path)
    (seed / "reference").mkdir()
    (seed / "reference" / "dict_key.json").write_text("{not json", encoding="utf-8")
    load(gw, seed)
    assert count(gw, "dict_key") == 2


def test_error_message_does_not_carry_row_values(gw, tmp_path):
    seed = copy_seed(tmp_path)
    payload = {"rows": [{"scope": "system", "scope_id": "", "key": "V-SECRET", "bogus": "V-SECRET"}]}
    (seed / "dict_label.json").write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(Exception) as error:
        load(gw, seed)
    assert "V-SECRET" not in str(error.value)


def test_command_prints_only_row_counts(tmp_path):
    db = tmp_path / "cli.db"
    result = subprocess.run(
        [sys.executable, "-m", "core.seed_load", str(OK), "--db", str(db)],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "dict_key" in result.stdout and "V1" not in result.stdout
