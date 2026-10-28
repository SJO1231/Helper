"""raw의 정본 글자와 해시. captured_at은 raw에 넣지 않으므로 같은 화면이면 해시가 같다."""
import hashlib
import json


def canonical(raw):
    return json.dumps(raw, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def raw_hash(raw):
    return hashlib.sha256(canonical(raw).encode("utf-8")).hexdigest()
