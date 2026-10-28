import re
from pathlib import Path

CORE = Path(__file__).resolve().parents[1]
DRIVER = "sqlite" + "3"  # 이 파일이 grep에 걸리지 않게 이름을 쪼갠다


def source_files():
    return [f for f in CORE.rglob("*.py") if "tests" not in f.parts]


def test_only_gateway_imports_the_sql_driver():
    pattern = re.compile(rf"^\s*(import|from)\s+{DRIVER}", re.M)
    hits = [f.name for f in source_files() if pattern.search(f.read_text(encoding="utf-8"))]
    assert hits == ["gateway.py"]


def test_driver_name_appears_only_in_gateway():
    hits = [f.name for f in CORE.rglob("*.py") if DRIVER in f.read_text(encoding="utf-8")]
    assert hits == ["gateway.py"]


def test_files_stay_within_size_rules():
    for path in CORE.rglob("*.py"):
        lines = path.read_text(encoding="utf-8").splitlines()
        assert len(lines) <= 300, f"{path.name}: {len(lines)}줄"
        too_long = [n for n, line in enumerate(lines, 1) if len(line) > 120]
        assert not too_long, f"{path.name}: 120자 넘는 줄 {too_long}"
