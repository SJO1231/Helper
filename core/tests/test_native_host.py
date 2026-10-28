import io
import json
import socket
import struct
import urllib.request

import pytest

from core import runtime
from core.native_host import NativeHost, native_loop, response_frames
from core.tests.support import ROOT

HELLO = {"type": "hello"}


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("HELPER_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("HELPER_DB", str(tmp_path / "h.db"))
    return tmp_path


def must_not_start():
    raise AssertionError("서비스를 또 띄우면 안 된다")


def test_hello_returns_port_token_version(home):
    runtime.write_runtime(8765, "T")
    host = NativeHost(is_alive=lambda port: True, start_service=must_not_start)
    assert host.handle(HELLO) == {"port": 8765, "token": "T", "schema_version": 1}


def test_hello_starts_service_when_missing(home):
    started = []

    def start():
        started.append(1)
        runtime.write_runtime(8765, "T2")

    host = NativeHost(is_alive=lambda port: bool(started), start_service=start, wait_seconds=2)
    assert host.handle(HELLO) == {"port": 8765, "token": "T2", "schema_version": 1}
    assert started == [1]


def test_hello_ignores_stale_runtime_of_dead_service(home):
    runtime.write_runtime(1, "OLD")
    started = []

    def start():
        started.append(1)
        runtime.write_runtime(8765, "NEW")

    host = NativeHost(is_alive=lambda port: port != 1, start_service=start, wait_seconds=2)
    assert host.handle(HELLO)["token"] == "NEW"


def test_hello_reports_503_when_service_never_comes_up(home):
    host = NativeHost(is_alive=lambda port: False, start_service=lambda: None, wait_seconds=0.2)
    reply = host.handle(HELLO)
    assert reply["status"] == 503 and "error" in reply["body"]


def request(method, path, body=None, request_id="r1"):
    headers = {"X-Schema-Version": "1"}
    if request_id:
        headers["X-Request-Id"] = request_id
    return {"type": "request", "method": method, "path": path, "headers": headers, "body": body}


def test_request_fallback_uses_same_routes(home):
    host = NativeHost(is_alive=lambda port: False, start_service=lambda: None, wait_seconds=0)
    reply = host.handle(request("GET", "/api/tables", request_id=None))
    assert reply["status"] == 200 and "g2b_bid" in [t["id"] for t in reply["body"]["tables"]]
    host.close()


def test_request_fallback_keeps_write_rules(home):
    host = NativeHost(is_alive=lambda port: False, start_service=lambda: None, wait_seconds=0)
    assert host.handle(request("POST", "/api/tables/g2b_bid/records", {"records": []}))["status"] == 405
    assert host.handle(request("POST", "/api/tables/dict_code/records", {"records": []}, None))["status"] == 400
    bad_version = request("GET", "/api/tables")
    bad_version["headers"]["X-Schema-Version"] = "2"
    assert host.handle(bad_version)["status"] == 409
    host.close()


def test_unknown_message_type_is_400(home):
    host = NativeHost(is_alive=lambda port: True, start_service=must_not_start)
    assert host.handle({"type": "nope"})["status"] == 400


def test_frames_larger_than_1mb_are_chunked():
    big = {"status": 200, "body": {"text": "가" * 400_000}}
    frames = response_frames(big)
    assert len(frames) > 1 and all(len(json.dumps(f, ensure_ascii=False).encode()) < 1_000_000 for f in frames)
    joined = "".join(f["chunk"]["text"] for f in sorted(frames, key=lambda f: f["chunk"]["index"]))
    assert json.loads(joined) == big
    assert response_frames({"status": 200, "body": {}}) == [{"status": 200, "body": {}}]


def frame(message):
    data = json.dumps(message).encode("utf-8") if not isinstance(message, bytes) else message
    return struct.pack("<I", len(data)) + data


def read_frames(raw):
    stream, out = io.BytesIO(raw), []
    while header := stream.read(4):
        out.append(json.loads(stream.read(struct.unpack("<I", header)[0])))
    return out


def test_native_loop_answers_each_frame_in_order(home):
    runtime.write_runtime(8765, "T")
    host = NativeHost(is_alive=lambda port: True, start_service=must_not_start)
    source, sink = io.BytesIO(frame(HELLO) + frame({"type": "nope"})), io.BytesIO()
    native_loop(host, source, sink)
    replies = read_frames(sink.getvalue())
    assert replies[0]["token"] == "T" and replies[1]["status"] == 400


def test_native_loop_reports_invalid_json_and_continues(home):
    runtime.write_runtime(8765, "T")
    host = NativeHost(is_alive=lambda port: True, start_service=must_not_start)
    sink = io.BytesIO()
    native_loop(host, io.BytesIO(frame(b"{oops") + frame(HELLO)), sink)
    replies = read_frames(sink.getvalue())
    assert replies[0]["status"] == 400 and replies[1]["token"] == "T"


def test_native_loop_rejects_truncated_frame(home):
    host = NativeHost(is_alive=lambda port: True, start_service=must_not_start)
    with pytest.raises(EOFError):
        native_loop(host, io.BytesIO(struct.pack("<I", 50) + b"{}"), io.BytesIO())


def free_port():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def test_real_hello_spawns_service_that_answers_with_token(home, monkeypatch):
    monkeypatch.setenv("HELPER_PORT", str(free_port()))
    monkeypatch.setenv("PYTHONPATH", str(ROOT))
    host = NativeHost(wait_seconds=10)
    try:
        info = host.handle(HELLO)
        assert info["schema_version"] == 1 and info["token"]
        url = f"http://127.0.0.1:{info['port']}/api/tables"
        headers = {"Authorization": f"Bearer {info['token']}", "X-Schema-Version": "1"}
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers)) as response:
            assert response.status == 200
        assert host.handle(HELLO) == info  # 두 번째 hello는 새로 띄우지 않는다
    finally:
        host.stop_spawned_service()
        host.close()
