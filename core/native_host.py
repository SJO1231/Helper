"""Chrome Native Messaging 호스트. stdout에는 프레임만 쓴다.
native_loop는 carryover/native/host.py의 프레이밍을 그대로 쓰고 옛 pce import만 뺐다."""
import json
import os
import socket
import struct
import subprocess
import sys
import time
from pathlib import Path

from core import runtime
from core.gateway import SCHEMA_VERSION, Gateway
from core.routes import handle


def loads(text):
    return json.loads(text)


def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def read_exact(stream, length):
    result = b''
    while len(result) < length:
        chunk = stream.read(length - len(result))
        if not chunk:
            if not result:
                return None
            raise EOFError('Truncated native frame')
        result += chunk
    return result


def response_frames(response, request_id='', chunk_size=60000):
    encoded = dumps(response)
    if len(encoded.encode('utf-8')) < 750000:
        return [response]
    chunks = [encoded[i:i + chunk_size] for i in range(0, len(encoded), chunk_size)]
    # 확장은 조각을 요청의 requestId로 모으므로 응답 몸통이 아니라 요청에서 가져온다.
    return [{'requestId': request_id, 'chunk': {'index': i, 'total': len(chunks), 'text': text}}
            for i, text in enumerate(chunks)]


def native_loop(host, input_stream, output_stream):
    while True:
        header = read_exact(input_stream, 4)
        if header is None:
            return
        size = struct.unpack('<I', header)[0]
        if size > 64 * 1024 * 1024:
            raise ValueError('Native request exceeds 64 MiB')
        payload = read_exact(input_stream, size)
        if payload is None:
            raise EOFError('Missing request body')
        request_id = ''
        try:
            message = loads(payload.decode('utf-8'))
            if isinstance(message, dict):
                request_id = str(message.get('requestId', ''))
            response = host.handle(message)
        except (ValueError, UnicodeError) as error:
            response = {'status': 400, 'body': {'error': f'JSON을 읽을 수 없다: {error}'}}
        for frame in response_frames(response, request_id):
            encoded = dumps(frame).encode('utf-8')
            output_stream.write(struct.pack('<I', len(encoded)))
            output_stream.write(encoded)
            output_stream.flush()


def port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


def spawn_service():
    flags = 0
    if os.name == "nt":
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    package_root = Path(__file__).resolve().parents[1]
    return subprocess.Popen([sys.executable, "-m", "core.service"], cwd=package_root, creationflags=flags,
                            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


class NativeHost:
    def __init__(self, is_alive=port_open, start_service=spawn_service, wait_seconds=5.0):
        self.is_alive, self.start_service, self.wait_seconds = is_alive, start_service, wait_seconds
        self._gateway = None

    def handle(self, message):
        kind = message.get("type") if isinstance(message, dict) else None
        if kind == "hello":
            return self._hello()
        if kind == "request":
            return self._request(message)
        return {"status": 400, "body": {"error": "알 수 없는 메시지 type이다"}}

    def _live_info(self):
        info = runtime.read_runtime()
        return info if info and self.is_alive(info["port"]) else None

    def _hello(self):
        info = self._live_info()
        if info is None:
            self.start_service()
            deadline = time.monotonic() + self.wait_seconds
            while info is None and time.monotonic() < deadline:
                time.sleep(0.05)
                info = self._live_info()
        if info is None:
            return {"status": 503, "body": {"error": "로컬 서비스를 띄우지 못했다"}}
        return {"port": info["port"], "token": info["token"], "schema_version": SCHEMA_VERSION}

    def _request(self, message):
        if self._gateway is None:
            self._gateway = Gateway(runtime.db_path())
        status, body = handle(self._gateway, message.get("method", ""), message.get("path", ""),
                              message.get("headers") or {}, message.get("body"))
        return {"status": status, "body": body}

    def close(self):
        if self._gateway is not None:
            self._gateway.close()
