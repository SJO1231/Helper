"""서비스가 쓰고 네이티브 호스트가 읽는 실행 정보(포트·토큰)와 경로."""
import json
import os
from pathlib import Path

from core.gateway import DEFAULT_DB_NAME

DEFAULT_PORT = 8765


def home():
    if os.environ.get("HELPER_HOME"):
        return Path(os.environ["HELPER_HOME"])
    base = os.environ.get("LOCALAPPDATA") or Path.home() / ".local" / "share"
    return Path(base) / "helper"


def db_path():
    return Path(os.environ.get("HELPER_DB") or home() / DEFAULT_DB_NAME)


def port():
    return int(os.environ.get("HELPER_PORT") or DEFAULT_PORT)


def runtime_file():
    return home() / "runtime.json"


def write_runtime(port_number, token):
    path = runtime_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    scratch = path.with_suffix(".tmp")
    scratch.write_text(json.dumps({"port": port_number, "token": token}), encoding="utf-8")
    try:
        os.chmod(scratch, 0o600)  # 토큰이 든 파일이라 다른 사용자가 못 읽게
    except OSError:
        pass
    os.replace(scratch, path)


def read_runtime():
    try:
        info = json.loads(runtime_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return info if isinstance(info.get("port"), int) and info.get("token") else None
