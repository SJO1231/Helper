"""사전 해석 순서(SPEC 6절)의 Python 쪽. TS 쪽과 shared/fixtures/dictionary-cases.json을 같이 돈다."""


def resolve_std_key(k, screen_code, aliases, std_keys):
    by_screen = global_alias = None
    for alias in aliases:
        if alias["source_key"] != k:
            continue
        if alias.get("screen_code") == screen_code:
            by_screen = alias["std_key"]
        elif not alias.get("screen_code"):
            global_alias = alias["std_key"]
    if by_screen or global_alias:
        return by_screen or global_alias
    if k in std_keys:
        return k
    tail = k.rsplit(".", 1)[-1]
    return tail if tail in std_keys else None


def label_index(rows):
    return {(r["scope"], r["scope_id"], r["key"]): r["label"] for r in rows}


def resolve_label(index, key, screen_code, site, fallback=""):
    for scope, scope_id in (("user", ""), ("screen", screen_code), ("site", site), ("system", "")):
        label = index.get((scope, scope_id, key))
        if label:
            return label
    return fallback
