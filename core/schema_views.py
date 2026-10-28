"""공개 뷰 v_<단계>. 열 이름은 site > system 라벨이고 사용자 라벨은 쓰지 않는다."""
from core import dict_read
from core.dictionary import label_index, resolve_label
from core.sql_schema import SITE, STAGES, drop_view_statements, view_statement


def drop(db):
    for statement in drop_view_statements():
        db.run(statement)


def rebuild(db):
    drop(db)
    rows = [r for r in dict_read.labels(db) if r["scope"] in ("site", "system")]
    index = label_index(rows)
    for stage in STAGES:
        pairs = [(k["std_key"], resolve_label(index, k["std_key"], None, SITE, k["label"] or k["std_key"]))
                 for k in dict_read.column_keys(db, stage)]
        db.run(view_statement(stage, pairs))
