"""시험 공용 도구. 값은 V1 같은 자리표시뿐이다."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAPTURE_FIXTURE = ROOT / "shared" / "fixtures" / "capture-minimal.json"
SITE = "g2b"
MENU_NO = "M0001"


def point(k, v):
    return {"k": k, "v": v, "l": "L", "visible": True}


def capture_fields(key_a="V1", key_b="V1", points=(), tables=None):
    fields = json.loads(CAPTURE_FIXTURE.read_text(encoding="utf-8"))
    raw = fields["raw"]
    raw["pointInfo"] = [point("dmA.keyA", key_a), point("dmA.keyB", key_b), *points]
    if tables is not None:
        raw["tables"] = tables
    return fields


def seed_dictionary(gw, stage="bid", key_fields=("keyA",)):
    screen = {"scrn_no": "S0001", "menu_cang_val": "C1", "name": "N", "stage": stage, "key_fields": list(key_fields)}
    gw.upsert_records("dict_screen", [{"require": {"site": SITE, "menu_no": MENU_NO}, "fields": screen}], False)
    keys = [
        {"std_key": "keyA", "type": "text", "as_column": 1},
        {"std_key": "keyB", "type": "money", "as_column": 1},
        {"std_key": "keyC", "type": "text", "as_column": 0},
    ]
    base = {"module": "t", "stages": ["bid"]}
    gw.add_records("dict_key", [{"fields": {**base, "label": k["std_key"], **k}} for k in keys])


def count(gw, table):
    return gw.rows(f'SELECT COUNT(*) AS n FROM "{table}"')[0]["n"]


def total_rows(gw):
    names = [r["name"] for r in gw.rows("SELECT name FROM sqlite_master WHERE type='table'")]
    return sum(count(gw, name) for name in names)


def main_row(gw, table="g2b_bid"):
    rows = gw.rows(f'SELECT * FROM "{table}"')
    assert len(rows) == 1
    return rows[0]


def column_names(gw, table):
    return [r["name"] for r in gw.rows(f'PRAGMA table_info("{table}")')]


def insert_main(gw, table, rows):
    """화면 수집을 거치지 않고 메인 행을 직접 넣는다(읽기 시험용)."""
    with gw.tx():
        for row in rows:
            names = ", ".join(f'"{name}"' for name in row)
            marks = ", ".join("?" for _ in row)
            gw.run(f'INSERT INTO "{table}" ({names}) VALUES ({marks})', tuple(row.values()))
