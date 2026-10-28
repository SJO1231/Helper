"""업무키 값으로 record_id를 만든다. 구분자 | 가 값에 있으면 서로 다른 건이 섞이므로 거절한다."""

SEPARATOR = "|"


def build_record_id(values, key_fields):
    parts = []
    for name in key_fields:
        value = values.get(name, "")
        if value == "":
            return None, "업무키 값이 비어 있다"
        if SEPARATOR in value:
            return None, "업무키 값에 | 가 들어 있다"
        parts.append(value)
    return SEPARATOR.join(parts), None
