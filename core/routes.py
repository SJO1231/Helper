"""경로 → gateway 호출. HTTP 서비스와 네이티브 호스트의 예비 길이 같은 함수를 쓴다."""
import hmac
import json
import logging
import re
from urllib.parse import parse_qs, unquote, urlsplit

from core.errors import BadRequest, CoreError, NotFound, NotWritable
from core.gateway import SCHEMA_VERSION

ROUTE = re.compile(r"^/api/tables(?:/([^/]+)/(records|columns))?/?$")
CAPTURE_TABLE = "g2b_capture"
MAX_REQUEST_ID = 200
log = logging.getLogger("helper.core")


def handle(gateway, method, target, headers, body, token=None):
    """(HTTP 상태, 몸통). token이 None이면 인증을 건너뛴다(이미 호스트 안이라 믿는 길)."""
    try:
        return 200, _dispatch(gateway, method, target, {k.lower(): v for k, v in headers.items()}, body, token)
    except CoreError as error:
        return error.status, {"error": str(error)}
    except Exception as error:  # 어떤 실패도 {"error"} 몸통으로 돌려준다
        log.exception("처리 중 오류")
        return 500, {"error": f"내부 오류({type(error).__name__})"}


def _dispatch(gateway, method, target, headers, body, token):
    if token is not None:
        _check_token(headers, token)
    parts = urlsplit(target)
    match = ROUTE.match(parts.path)
    if not match:
        raise NotFound("없는 경로다")
    if headers.get("x-schema-version") != str(SCHEMA_VERSION):
        raise _Conflict(f"X-Schema-Version이 코어({SCHEMA_VERSION})와 다르다")
    table, kind = (unquote(match.group(1)), match.group(2)) if match.group(1) else (None, None)
    query = {k: v[-1] for k, v in parse_qs(parts.query).items()}
    if table is None:
        _require_method(method, ("GET",))
        return {"tables": gateway.list_tables()}
    gateway.require_table(table)
    if kind == "columns":
        _require_method(method, ("GET",))
        return {"columns": gateway.list_columns(table)}
    if method == "GET":
        return _read_records(gateway, table, query)
    return _write_records(gateway, method, table, query, headers, body)


class _Conflict(CoreError):
    status = 409


class _Unauthorized(CoreError):
    status = 401


def _check_token(headers, token):
    given = headers.get("authorization", "")
    expected = f"Bearer {token}"
    if not hmac.compare_digest(given.encode("utf-8"), expected.encode("utf-8")):
        raise _Unauthorized("토큰이 없거나 틀리다")


def _require_method(method, allowed):
    if method not in allowed:
        raise NotWritable(f"{method}는 이 경로에서 쓸 수 없다")


def _int(query, name, default):
    try:
        return int(query[name]) if name in query else default
    except ValueError as error:
        raise BadRequest(f"{name}은 정수여야 한다") from error


def _read_records(gateway, table, query):
    try:
        filters = json.loads(query["filter"]) if "filter" in query else None
    except ValueError as error:
        raise BadRequest("filter가 JSON이 아니다") from error
    if filters is not None and not isinstance(filters, dict):
        raise BadRequest("filter는 {열: [값]} 객체여야 한다")
    records, total = gateway.list_records(table, query.get("sort"), filters,
                                          _int(query, "limit", 500), _int(query, "offset", 0))
    return {"records": records, "total": total}


def _write_records(gateway, method, table, query, headers, body):
    is_dict = table.startswith("dict_")
    allowed = ("POST",) if table == CAPTURE_TABLE else ("POST", "PATCH", "PUT") if is_dict else ()
    if method not in allowed:
        raise NotWritable(f"{table}에는 {method}로 쓸 수 없다")
    request_id = headers.get("x-request-id", "")
    if not request_id or len(request_id) > MAX_REQUEST_ID:
        raise BadRequest("쓰기 요청에는 X-Request-Id가 있어야 한다")
    if not isinstance(body, dict) or not isinstance(body.get("records"), list):
        raise BadRequest('몸통은 {"records": [...]} 이어야 한다')
    records = body["records"]
    if table == CAPTURE_TABLE:
        if len(records) != 1 or not isinstance(records[0], dict):
            raise BadRequest("수집은 요청 하나에 레코드 하나다")
        result = gateway.write_capture(records[0].get("fields"), request_id)
        return {"records": [{"id": result["record_id"] or "", "fields": result}]}
    if method == "POST":
        return {"records": gateway.add_records(table, records, request_id)}
    if method == "PATCH":
        return {"records": gateway.update_records(table, records, request_id)}
    noupdate = query.get("noupdate") == "true" or body.get("noupdate") is True
    return {"records": gateway.upsert_records(table, records, noupdate, request_id)}
