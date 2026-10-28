"""표 행(물품·승격된 하위 표) 한 줄을 표준키 칸으로 옮긴다."""
import json

from core.dictionary import resolve_std_key
from core.sql_records import insert_statement


def line_values(line, screen_code, aliases, std_keys, columns):
    values = {}
    for k, v in line.items():
        std = resolve_std_key(k, screen_code, aliases, std_keys)
        if std in columns and v != "" and std not in values:
            values[std] = v
    return values


def insert_line(db, table, record_id, line_no, line, values):
    fields = {"record_id": record_id, "line_no": line_no, "raw_line": json.dumps(line, ensure_ascii=False), **values}
    db.run(*insert_statement(table, fields, replace=True))
