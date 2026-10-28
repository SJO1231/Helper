"""메인 행 병합. 화면 값이 빈 칸이면 DB 값을 지우지 않는다."""


def merge_main(existing, incoming):
    merged = dict(existing)
    changed = []
    for key, value in incoming.items():
        if value == "" or existing.get(key) == value:
            continue
        merged[key] = value
        changed.append(key)
    return merged, changed
