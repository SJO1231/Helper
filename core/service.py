"""127.0.0.1 로컬 HTTP. 토큰·머리 검사와 경로 처리는 routes가 한다."""
import json
import logging
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from core import runtime
from core.gateway import Gateway
from core.routes import handle

MAX_BODY = 20 * 1024 * 1024
HOST = "127.0.0.1"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _reply(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            self.close_connection = True
            return self._reply(413, {"error": "몸통이 20MB를 넘는다"})
        raw = self.rfile.read(length) if length else b""
        try:
            body = json.loads(raw) if raw else None
        except ValueError:
            return self._reply(400, {"error": "몸통이 JSON이 아니다"})
        status, payload = handle(self.server.gateway, self.command, self.path, dict(self.headers.items()),
                                 body, self.server.token)
        self._reply(status, payload)

    do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = _serve


def create_server(gateway, token, port):
    server = ThreadingHTTPServer((HOST, port), Handler)
    server.daemon_threads = True
    server.gateway, server.token = gateway, token
    return server


def main():
    logging.basicConfig(level=logging.INFO)
    gateway = Gateway(runtime.db_path())
    token = secrets.token_urlsafe(32)
    server = create_server(gateway, token, runtime.port())
    runtime.write_runtime(server.server_address[1], token)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        gateway.close()


if __name__ == "__main__":
    main()
