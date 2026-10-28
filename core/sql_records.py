"""쓰기 문장 만들기. 이름은 모두 quote_ident를 거치고 값은 늘 바인딩한다."""
from core.sql_schema import quote_ident


def insert_statement(table, fields, replace=False):
    verb = "INSERT OR REPLACE" if replace else "INSERT"
    if not fields:
        return f"{verb} INTO {quote_ident(table)} DEFAULT VALUES", ()
    names = ", ".join(quote_ident(name) for name in fields)
    marks = ", ".join("?" for _ in fields)
    return f"{verb} INTO {quote_ident(table)} ({names}) VALUES ({marks})", tuple(fields.values())


def update_statement(table, fields, where_sql, where_params):
    sets = ", ".join(f"{quote_ident(name)} = ?" for name in fields)
    return f"UPDATE {quote_ident(table)} SET {sets} WHERE {where_sql}", (*fields.values(), *where_params)


def upsert_statement(table, row, key_column):
    """row에 든 열만 갱신한다. 빈 칸을 빼고 넘기면 DB 값이 그대로 남는다."""
    names = ", ".join(quote_ident(name) for name in row)
    marks = ", ".join("?" for _ in row)
    updates = ", ".join(f"{quote_ident(n)} = excluded.{quote_ident(n)}" for n in row if n != key_column)
    return (f"INSERT INTO {quote_ident(table)} ({names}) VALUES ({marks})"
            f" ON CONFLICT ({quote_ident(key_column)}) DO UPDATE SET {updates}"), tuple(row.values())


def where_equal(conditions):
    """{열: 값} → 'a = ? AND b = ?'"""
    return " AND ".join(f"{quote_ident(name)} = ?" for name in conditions), tuple(conditions.values())
