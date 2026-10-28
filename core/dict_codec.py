"""dict_* 행의 JSON 칸 바꿔 담기와 키 열 정보."""
import json

JSON_FIELDS = {
    "dict_key": ("stages", "display"),
    "dict_screen": ("key_fields", "link", "options"),
    "dict_child": ("key_fields",),
}
PRIMARY_KEYS = {
    "dict_key": ("std_key",),
    "dict_alias": ("site", "screen_code", "source_key"),
    "dict_label": ("scope", "scope_id", "key"),
    "dict_code": ("std_key", "code", "scope"),
    "dict_screen": ("site", "menu_no"),
    "dict_child": ("table_code",),
}
# 비어 있음을 NULL이 아니라 빈 글자로 저장하는 키 열(NULL은 PK 중복을 못 막는다)
BLANK_KEY_COLUMNS = {"dict_alias": ("screen_code",), "dict_label": ("scope_id",), "dict_code": ("scope",)}


def encode_fields(table, fields):
    encoded = {}
    for name, value in fields.items():
        if name in JSON_FIELDS.get(table, ()) and value is not None:
            value = json.dumps(value, ensure_ascii=False)
        elif isinstance(value, bool):
            value = int(value)
        elif value is None and name in BLANK_KEY_COLUMNS.get(table, ()):
            value = ""
        encoded[name] = value
    return encoded


def decode_row(table, row):
    decoded = dict(row)
    for name in JSON_FIELDS.get(table, ()):
        if decoded.get(name) is not None:
            decoded[name] = json.loads(decoded[name])
    return decoded
