import http.client
import json
import threading
import urllib.error
import urllib.request
from types import SimpleNamespace

import pytest

from core.service import create_server
from core.tests.support import capture_fields

TOKEN = "T0K"
NO_ID = object()


@pytest.fixture
def srv(seeded):
    server = create_server(seeded, TOKEN, 0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield SimpleNamespace(base=f"http://127.0.0.1:{server.server_address[1]}", gw=seeded)
    server.shutdown()
    server.server_close()


def call(srv, method, path, body=None, token=TOKEN, headers=None, request_id="rid-1", data=None):
    sent = {"X-Schema-Version": "1", "Content-Type": "application/json"}
    if token is not None:
        sent["Authorization"] = f"Bearer {token}"
    if method != "GET" and request_id is not NO_ID:
        sent["X-Request-Id"] = request_id
    sent.update(headers or {})
    payload = data if data is not None else (json.dumps(body).encode() if body is not None else None)
    request = urllib.request.Request(srv.base + path, data=payload, headers=sent, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            return SimpleNamespace(status=response.status, body=json.loads(response.read()))
    except urllib.error.HTTPError as error:
        return SimpleNamespace(status=error.code, body=json.loads(error.read()))


def capture_body(**kwargs):
    return {"records": [{"fields": capture_fields(**kwargs)}]}


def test_missing_or_wrong_token_is_401(srv):
    assert call(srv, "GET", "/api/tables", token=None).status == 401
    assert call(srv, "GET", "/api/tables", token="wrong").status == 401


def test_valid_token_lists_tables(srv):
    reply = call(srv, "GET", "/api/tables")
    assert reply.status == 200 and "g2b_bid" in [t["id"] for t in reply.body["tables"]]


def test_schema_version_mismatch_is_409(srv):
    assert call(srv, "GET", "/api/tables", headers={"X-Schema-Version": "2"}).status == 409
    assert call(srv, "GET", "/api/tables", headers={"X-Schema-Version": ""}).status == 409


def test_write_without_request_id_is_400(srv):
    assert call(srv, "POST", "/api/tables/g2b_capture/records", capture_body(), request_id=NO_ID).status == 400


def test_write_to_main_table_is_405(srv):
    for method in ("POST", "PATCH", "PUT"):
        reply = call(srv, method, "/api/tables/g2b_bid/records", {"records": []})
        assert reply.status == 405 and set(reply.body) == {"error"}
    assert call(srv, "PATCH", "/api/tables/g2b_capture/records", {"records": []}).status == 405
    assert call(srv, "DELETE", "/api/tables/dict_key/records").status == 405


def test_unknown_table_and_path_are_404(srv):
    assert call(srv, "GET", "/api/tables/nope/records").status == 404
    assert call(srv, "GET", "/api/nope").status == 404
    assert call(srv, "POST", "/api/tables/nope/records", {"records": []}).status == 404


def test_capture_post_returns_grist_shape(srv):
    reply = call(srv, "POST", "/api/tables/g2b_capture/records", capture_body())
    record = reply.body["records"][0]
    assert reply.status == 200 and record["fields"]["status"] == "new" and record["id"] == "V1"


def test_capture_retry_with_same_request_id_gives_same_response(srv):
    first = call(srv, "POST", "/api/tables/g2b_capture/records", capture_body())
    again = call(srv, "POST", "/api/tables/g2b_capture/records", capture_body())
    assert first.body == again.body
    assert call(srv, "GET", "/api/tables/g2b_capture/records").body["total"] == 1


def test_capture_rejected_is_still_200_with_reason(srv):
    reply = call(srv, "POST", "/api/tables/g2b_capture/records", capture_body(key_a=""))
    assert reply.status == 200 and reply.body["records"][0]["fields"]["reason"]


def test_bad_capture_body_is_400(srv):
    path = "/api/tables/g2b_capture/records"
    assert call(srv, "POST", path, {"records": [{"fields": {"site": "g2b"}}]}).status == 400
    assert call(srv, "POST", path, {"records": []}).status == 400
    assert call(srv, "POST", path, data=b"{not json").status == 400


def test_records_query_sort_filter_limit_offset(srv):
    for n in (1, 2, 3):
        call(srv, "POST", "/api/tables/g2b_capture/records", capture_body(key_a=f"A{n}"), request_id=f"r{n}")
    flt = urllib.request.quote(json.dumps({"keyA": ["A1", "A3"]}))
    reply = call(srv, "GET", f"/api/tables/g2b_bid/records?sort=-keyA&filter={flt}&limit=1&offset=1")
    assert reply.status == 200 and reply.body["total"] == 2
    assert [r["id"] for r in reply.body["records"]] == ["A1"]
    assert call(srv, "GET", "/api/tables/g2b_bid/records?sort=nope").status == 400
    assert call(srv, "GET", "/api/tables/g2b_bid/records?filter=%7Bbad").status == 400
    assert call(srv, "GET", "/api/tables/g2b_bid/records?limit=abc").status == 400


def test_columns_route(srv):
    reply = call(srv, "GET", "/api/tables/g2b_bid/columns")
    assert [c["id"] for c in reply.body["columns"]] == ["keyA", "keyB"]


def test_dict_screen_auto_register_put_noupdate_twice(srv):
    body = {"records": [{"require": {"site": "g2b", "menu_no": "M7"},
                         "fields": {"scrn_no": "S7", "menu_cang_val": "C7", "name": "N7"}}]}
    first = call(srv, "PUT", "/api/tables/dict_screen/records?noupdate=true", body, request_id="a")
    second = call(srv, "PUT", "/api/tables/dict_screen/records?noupdate=true", body, request_id="b")
    assert first.status == second.status == 200 and first.body == second.body
    listed = call(srv, "GET", "/api/tables/dict_screen/records?filter=" + urllib.request.quote('{"menu_no":["M7"]}'))
    assert listed.body["total"] == 1


def test_dict_post_patch_roundtrip(srv):
    made = call(srv, "POST", "/api/tables/dict_code/records",
                {"records": [{"fields": {"std_key": "keyA", "code": "1", "meaning": "M"}}]}, request_id="a")
    row_id = made.body["records"][0]["id"]
    patched = call(srv, "PATCH", "/api/tables/dict_code/records",
                   {"records": [{"id": row_id, "fields": {"meaning": "M2"}}]}, request_id="b")
    assert patched.body == {"records": [{"id": row_id}]}
    listed = call(srv, "GET", "/api/tables/dict_code/records")
    assert listed.body["records"][0]["fields"]["meaning"] == "M2"


def test_dict_validation_error_is_400_not_500(srv):
    body = {"records": [{"fields": {"std_key": "keyZ", "stages": ["nowhere"]}}]}
    reply = call(srv, "POST", "/api/tables/dict_key/records", body)
    assert reply.status == 400 and set(reply.body) == {"error"}


def test_body_over_20mb_is_413(srv):
    """본문을 읽기 전에 Content-Length만 보고 거절하므로, 시험도 길이만 알린다."""
    connection = http.client.HTTPConnection(srv.base.removeprefix("http://"))
    connection.putrequest("POST", "/api/tables/g2b_capture/records")
    for name, value in {"Authorization": f"Bearer {TOKEN}", "X-Schema-Version": "1", "X-Request-Id": "big",
                        "Content-Length": str(20 * 1024 * 1024 + 1)}.items():
        connection.putheader(name, value)
    connection.endheaders()
    response = connection.getresponse()
    assert response.status == 413 and "error" in json.loads(response.read())
    connection.close()


def test_error_body_is_error_text(srv):
    reply = call(srv, "GET", "/api/tables", token="bad")
    assert set(reply.body) == {"error"} and isinstance(reply.body["error"], str)
