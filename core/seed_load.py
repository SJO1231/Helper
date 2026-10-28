"""shared/seed/dict_*.json을 사전에 넣는 설치용 명령. 자동 실행은 없다.
이미 있는 행은 바꾸지 않아(noupdate) 같은 파일을 몇 번 넣어도 결과가 같다. 출력과 오류에는 행 값을 담지 않는다."""
import argparse
import json
import sys
from pathlib import Path

from core import runtime
from core.dict_codec import PRIMARY_KEYS
from core.errors import BadRequest
from core.gateway import Gateway

# 키가 먼저여야 as_column 승격이 stages 열을 만든다
SEED_FILES = ("dict_key.json", "dict_alias.json", "dict_label.json", "dict_code.json", "dict_screen.json",
              "dict_child.json")
DEFAULT_SEED_DIR = Path(__file__).resolve().parents[1] / "shared" / "seed"


class SeedError(Exception):
    pass


def load(gw, seed_dir):
    """여섯 파일을 한 트랜잭션으로 넣고 표마다 더한 행 수를 돌려준다. 하나라도 틀리면 아무것도 넣지 않는다."""
    parsed = {name: _read_rows(Path(seed_dir) / name, name.removesuffix(".json")) for name in SEED_FILES}
    added = {}
    with gw.tx():
        for name, rows in parsed.items():
            table = name.removesuffix(".json")
            before = _count(gw, table)
            _upsert_all(gw, table, rows)
            added[table] = _count(gw, table) - before
    return added


def _read_rows(path, table):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise SeedError(f"{path.name}을 읽을 수 없다: {type(error).__name__}") from None
    rows = data.get("rows") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        raise SeedError(f"{path.name}은 {{\"rows\": [...]}} 꼴이어야 한다")
    for number, row in enumerate(rows):
        if not isinstance(row, dict) or not set(PRIMARY_KEYS[table]) <= set(row) | _nullable_keys(table):
            raise SeedError(f"{path.name} {number}번째 행에 키 열이 없다")
    return rows


def _nullable_keys(table):
    return {"dict_alias": {"screen_code"}, "dict_label": {"scope_id"}, "dict_code": {"scope"}}.get(table, set())


def _upsert_all(gw, table, rows):
    keys = PRIMARY_KEYS[table]
    records = [{"require": {k: row.get(k) for k in keys}, "fields": {k: v for k, v in row.items() if k not in keys}}
               for row in rows]
    try:
        gw.upsert_records(table, records, noupdate=True)
    except BadRequest as error:
        raise SeedError(f"{table}: 사전 규칙에 맞지 않는 행이 있다 ({error})") from None


def _count(gw, table):
    return gw.rows(f'SELECT COUNT(*) AS n FROM "{table}"')[0]["n"]


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m core.seed_load", description="seed 사전 파일을 DB에 넣는다")
    parser.add_argument("seed_dir", nargs="?", default=str(DEFAULT_SEED_DIR))
    parser.add_argument("--db", default=None, help="기본은 서비스가 쓰는 DB")
    args = parser.parse_args(argv)
    gw = Gateway(args.db or runtime.db_path())
    try:
        added = load(gw, args.seed_dir)
    except SeedError as error:
        print(f"적재 실패: {error}", file=sys.stderr)
        return 1
    finally:
        gw.close()
    for table, number in added.items():
        print(f"{table}: {number}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
