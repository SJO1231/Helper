"""bench용 합성 자료. 빈 DB에 dict_key와 g2b_bid 행을 넣는다. 값은 모두 자리표시와 난수다.

사용: python scripts/bench/seed_synthetic.py --db <파일> --rows 1000|10000
표준 출력에 JSON 한 줄: bench가 기대값으로 쓰는 열 수와 열 이름.
"""
import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from core.gateway import Gateway  # noqa: E402

COLUMNS = 100
TYPES = ("text", "money", "date")
# 뷰어 열에 들어가면 안 되는 표준키: 다른 단계 전용, 열이 아닌 키.
DECOYS = (
    {"std_key": "decoyReceipt", "stages": ["receipt"], "as_column": 1},
    {"std_key": "decoyNoColumn", "stages": ["bid"], "as_column": 0},
)


def column_name(index):
    return f"key{index:02d}"


def key_rows():
    rows = [
        {"std_key": column_name(i), "module": "bench", "stages": ["bid"], "type": TYPES[i % len(TYPES)],
         "label": f"라벨{i:02d}", "as_column": 1, "index": 0}
        for i in range(COLUMNS)
    ]
    rows += [{"module": "bench", "type": "text", "label": d["std_key"], **d} for d in DECOYS]
    return rows


def cell_value(rng, kind, row, column):
    if kind == "money":
        return str(rng.randrange(10 ** rng.randrange(3, 10)))
    if kind == "date":
        return f"20{rng.randrange(10, 30)}{rng.randrange(1, 13):02d}{rng.randrange(1, 29):02d}"
    return f"V{row:06d}_{column:02d}"


def seed(gateway, rows, rng):
    keys = key_rows()
    gateway.add_records("dict_key", [{"fields": row} for row in keys])
    names = [column_name(i) for i in range(COLUMNS)]
    order = list(range(rows))
    rng.shuffle(order)  # 정렬하면 첫 행이 확실히 바뀌게 text 열 값을 섞어 둔다
    columns = ["record_id", "key1", *names]
    sql = f'INSERT INTO "g2b_bid" ({", ".join(columns)}) VALUES ({", ".join("?" for _ in columns)})'
    with gateway.tx():
        for row in range(rows):
            values = [cell_value(rng, TYPES[i % len(TYPES)], order[row], i) for i in range(COLUMNS)]
            gateway.run(sql, (f"R{row:06d}", f"R{row:06d}", *values))
    return names


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--rows", type=int, required=True)
    args = parser.parse_args()
    gateway = Gateway(Path(args.db))
    try:
        names = seed(gateway, args.rows, random.Random(20261028))
    finally:
        gateway.close()
    wanted = [k for k in key_rows() if "bid" in k["stages"] and k["as_column"] == 1]
    print(json.dumps({"rows": args.rows, "expected_columns": len(wanted), "columns": names}))


if __name__ == "__main__":
    main()
