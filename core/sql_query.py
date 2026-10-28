"""읽기 문장 만들기(ORDER BY·WHERE). 숫자·날짜 정렬 키는 gateway가 SQL 함수로 등록한다."""
from core.errors import BadRequest
from core.sql_schema import quote_ident

NUMERIC = ("number", "money", "percent")
DATES = ("date", "datetime")
DIGITS = "0123456789"


def num_key(value):
    if value is None:
        return None
    try:
        return float("".join(ch for ch in str(value) if ch in DIGITS + ".-"))
    except ValueError:
        return None


def digit_key(value):
    digits = "".join(ch for ch in str(value or "") if ch in DIGITS)
    return digits or None


def sort_expression(column, key_type):
    name = quote_ident(column)
    if key_type in NUMERIC:
        return f"num_key({name})"
    if key_type in DATES:
        return f"digit_key({name})"
    return f"NULLIF({name}, '')"


def order_by(sort, types, columns):
    """빈 값은 오름·내림 모두 맨 뒤. 마지막에 rowid로 쪽 넘김 순서를 고정한다."""
    parts = []
    for item in (sort or "").split(","):
        item = item.strip()
        if not item:
            continue
        descending = item.startswith("-")
        column = item[1:] if descending else item
        if column not in columns:
            raise BadRequest("정렬에 쓸 수 없는 열이다")
        expression = sort_expression(column, types.get(column, "text"))
        parts.append(f"({expression} IS NULL) ASC, {expression} {'DESC' if descending else 'ASC'}")
    parts.append("rowid ASC")
    return ", ".join(parts)


def where_clause(filters, columns, hide_deleted):
    clauses, params = [], []
    for column, values in (filters or {}).items():
        if column not in columns:
            raise BadRequest("필터에 쓸 수 없는 열이다")
        values = [str(v) for v in values] if isinstance(values, list) else [str(values)]
        name = quote_ident(column)
        if not values:
            clauses.append("0")
            continue
        clause = f"{name} IN ({', '.join('?' for _ in values)})"
        clauses.append(f"({clause} OR {name} IS NULL)" if "" in values else clause)
        params.extend(values)
    if hide_deleted:
        clauses.append("deleted_at IS NULL")
    return (" WHERE " + " AND ".join(clauses)) if clauses else "", params
