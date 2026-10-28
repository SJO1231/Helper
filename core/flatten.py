"""raw를 표준키 값과 하위 표 행으로 편다. 값은 원문 글자로만 다룬다."""
from dataclasses import dataclass, field

from core.dictionary import resolve_std_key


def text(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


@dataclass
class Flat:
    values: dict = field(default_factory=dict)
    tables: list = field(default_factory=list)
    unknown_keys: int = 0


def flatten(raw, screen_code, aliases, std_keys):
    flat, unknown = Flat(), set()

    def take(k, value):
        std = resolve_std_key(k, screen_code, aliases, std_keys)
        if std is None:
            unknown.add(k)
        elif flat.values.get(std, "") == "":
            flat.values[std] = text(value)

    for point in raw.get("pointInfo", []):
        take(point["k"], point.get("v"))
    for name, value in raw.get("param", {}).items():
        take(f"param.{name}", value)
    for table in raw.get("tables", []):
        for column in table.get("columns", []):
            if resolve_std_key(column["k"], screen_code, aliases, std_keys) is None:
                unknown.add(column["k"])
        rows = [{k: text(v) for k, v in row.items()} for row in table.get("rows", [])]
        flat.tables.append((table["dataList"], rows))
    flat.unknown_keys = len(unknown)
    return flat
