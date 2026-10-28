import pytest

from core.gateway import Gateway
from core.sql_schema import quote_ident
from core.tests.support import column_names, count


def table_names(gw):
    return {r["name"] for r in gw.rows("SELECT name FROM sqlite_master WHERE type='table'")}


def pk_cols(gw, table):
    rows = [r for r in gw.rows(f'PRAGMA table_info("{table}")') if r["pk"]]
    return [r["name"] for r in sorted(rows, key=lambda r: r["pk"])]


def test_fresh_db_has_all_spec_tables(gw):
    expected = {"g2b_capture", "g2b_receipt", "g2b_bid", "g2b_contract", "g2b_bid_item", "g2b_bid_child",
                "dict_key", "dict_alias", "dict_label", "dict_code", "dict_screen", "dict_child", "dict_relation",
                "user_column", "request_log", "schema_version", "settings_shared", "settings_personal"}
    assert expected <= table_names(gw)


def test_dict_screen_primary_key_is_site_and_menu_no(gw):
    assert pk_cols(gw, "dict_screen") == ["site", "menu_no"]


def test_main_table_fixed_columns(gw):
    assert column_names(gw, "g2b_bid")[:9] == ["record_id", "key1", "key2", "latest_capture_id", "captured_at",
                                               "screen_code", "store_version", "deleted_at", "user_values"]


def test_schema_version_row_and_public_views(gw):
    assert gw.rows("SELECT module, version FROM schema_version") == [{"module": "g2b", "version": 1}]
    views = {r["name"] for r in gw.rows("SELECT name FROM sqlite_master WHERE type='view'")}
    assert views == {"v_receipt", "v_bid", "v_contract"}


def test_uses_wal_and_busy_timeout(gw):
    assert gw.rows("PRAGMA journal_mode")[0]["journal_mode"] == "wal"
    assert gw.rows("PRAGMA busy_timeout")[0]["timeout"] == 5000


def test_reopen_is_idempotent_and_keeps_data(tmp_path):
    path = tmp_path / "h.db"
    first = Gateway(path)
    first.add_records("dict_code", [{"fields": {"std_key": "keyA", "code": "1", "meaning": "M"}}])
    first.close()
    second = Gateway(path)
    assert count(second, "dict_code") == 1
    second.close()


def test_quote_ident_rejects_injection():
    with pytest.raises(ValueError):
        quote_ident('a"; drop')
    assert quote_ident("keyA") == '"keyA"'


def test_backup_makes_openable_copy_with_data(gw, tmp_path):
    gw.add_records("dict_code", [{"fields": {"std_key": "keyA", "code": "1", "meaning": "M"}}])
    copy = tmp_path / "b.db"
    gw.backup(copy)
    other = Gateway(copy)
    assert table_names(other) == table_names(gw) and count(other, "dict_code") == 1
    other.close()


def test_backup_refuses_to_overwrite(gw, tmp_path):
    target = tmp_path / "b.db"
    target.write_bytes(b"x")
    with pytest.raises(FileExistsError):
        gw.backup(target)
