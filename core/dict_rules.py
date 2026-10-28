"""사전에 넣을 값의 규칙. 어기면 BadRequest이고, 쓰는 쪽 트랜잭션이 통째로 물러난다."""
import re

from core.errors import BadRequest
from core.sql_schema import IDENT, LINE_FIXED, MAIN_FIXED, STAGES

KEY_TYPES = ("text", "number", "money", "percent", "date", "datetime", "bool", "code")
STAGE_NAME = re.compile(r"^(receipt|bid|contract)(_(?!child$)[A-Za-z0-9]+)?$")
RESERVED = {name.lower() for name in MAIN_FIXED + LINE_FIXED}
FLAGS = ("as_column", "index", "derived", "typed")


def check_fields(table, fields):
    for name in FLAGS:
        if name in fields and fields[name] not in (0, 1, True, False):
            raise BadRequest(f"{name}은 0 또는 1이어야 한다")
    checker = {"dict_key": _check_key, "dict_screen": _check_screen, "dict_child": _check_child}.get(table)
    if checker:
        checker(fields)


def _check_key(fields):
    name = fields.get("std_key")
    if name is not None and (not isinstance(name, str) or not IDENT.match(name) or name.lower() in RESERVED):
        raise BadRequest("표준키 이름으로 쓸 수 없다")
    if "stages" in fields:
        stages = fields["stages"]
        if not isinstance(stages, list) or not all(isinstance(s, str) and STAGE_NAME.match(s) for s in stages):
            raise BadRequest("stages는 receipt·bid·contract 또는 <단계>_<이름> 글자의 목록이어야 한다")
    if "type" in fields and fields["type"] not in KEY_TYPES:
        raise BadRequest("type이 사전에 없는 종류다")
    if fields.get("display") is not None and not isinstance(fields["display"], dict):
        raise BadRequest("display는 객체여야 한다")


def _check_stage(fields):
    if fields.get("stage") is not None and fields["stage"] not in STAGES:
        raise BadRequest("stage는 receipt·bid·contract 중 하나이거나 비어 있어야 한다")


def _check_screen(fields):
    _check_stage(fields)
    keys = fields.get("key_fields", [])
    if not isinstance(keys, list) or len(keys) > 2 or not all(isinstance(k, str) for k in keys):
        raise BadRequest("key_fields는 표준키 1~2개의 목록이어야 한다")


def _check_child(fields):
    _check_stage(fields)
    if "key_fields" in fields and not isinstance(fields["key_fields"], list):
        raise BadRequest("key_fields는 목록이어야 한다")
