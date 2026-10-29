"""DB 백업·복원 명령. 복원은 DB 파일을 통째로 바꾸므로 코어 서비스가 꺼진 상태에서만 돌린다(판별은 하지 않는다)."""
import argparse
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

from core import runtime
from core.gateway import SCHEMA_VERSION, Gateway, StorageError

MAIN_TABLES = ("g2b_receipt", "g2b_bid", "g2b_contract")
BACKUP_DIR_NAME = "backups"


def _stamp():
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def _row_count(gw, table):
    return gw.rows(f'SELECT COUNT(*) AS n FROM "{table}"')[0]["n"]


def make(db_path, folder=None):
    folder = Path(folder) if folder else Path(db_path).parent / BACKUP_DIR_NAME
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"helper-{_stamp()}.sqlite"
    gw = Gateway(db_path)
    try:
        gw.backup(dest)
        counts = {table: _row_count(gw, table) for table in MAIN_TABLES}
    finally:
        gw.close()
    return dest, counts


def _preserve_current(db_path):
    """복원으로 덮어쓰기 전의 현재 DB를 같은 backups 폴더에 남긴다."""
    folder = Path(db_path).parent / BACKUP_DIR_NAME
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"helper-before-restore-{_stamp()}.sqlite"
    gw = Gateway(db_path)
    try:
        gw.backup(dest)
    finally:
        gw.close()
    return dest


def _replace_db_file(backup_file, db_path):
    for suffix in ("-wal", "-shm"):  # 옛 로그가 새 파일에 붙으면 안 된다
        Path(str(db_path) + suffix).unlink(missing_ok=True)
    scratch = Path(str(db_path) + ".restoring")
    shutil.copyfile(backup_file, scratch)
    os.replace(scratch, db_path)


def restore(backup_file, db_path):
    """(보존 파일 또는 None, integrity_check 결과)를 돌려준다. 버전이 다르면 아무것도 바꾸지 않고 ValueError."""
    version = Gateway.stored_schema_version(backup_file)
    if version != SCHEMA_VERSION:
        raise ValueError(f"schema_version이 다르다(백업 {version}, 코어 {SCHEMA_VERSION}). 복원하지 않았다")
    kept = _preserve_current(db_path) if Path(db_path).exists() else None
    _replace_db_file(backup_file, db_path)
    gw = Gateway(db_path)
    try:
        return kept, gw.integrity_check()
    finally:
        gw.close()


def _run_make(args):
    db_path = Path(args.db or runtime.db_path())
    if not db_path.exists():
        print(f"DB 파일이 없다: {db_path}", file=sys.stderr)
        return 1
    dest, counts = make(db_path, args.to)
    print(f"백업 만듦: {dest}")
    for table, number in counts.items():
        print(f"{table}: {number}")
    return 0


def _run_restore(args):
    print("복원은 DB 파일을 바꾼다. 코어를 끄고 돌리세요.")
    db_path = Path(args.db or runtime.db_path())
    if not Path(args.backup_file).is_file():
        print(f"백업 파일이 없다: {args.backup_file}", file=sys.stderr)
        return 1
    try:
        kept, integrity = restore(args.backup_file, db_path)
    except (ValueError, StorageError, FileExistsError) as error:
        print(f"복원 실패: {error}", file=sys.stderr)
        return 1
    print(f"복원 전 DB 보존: {kept}" if kept else "복원 전 DB가 없어 보존하지 않았다")
    print(f"integrity_check: {integrity}")
    return 0 if integrity == "ok" else 1


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m core.backup", description="DB 백업·복원")
    commands = parser.add_subparsers(dest="command", required=True)
    make_parser = commands.add_parser("make", help="백업 파일을 만든다")
    make_parser.add_argument("--db", default=None, help="기본은 서비스가 쓰는 DB")
    make_parser.add_argument("--to", default=None, help="기본은 DB 파일 옆 backups/")
    restore_parser = commands.add_parser("restore", help="백업 파일로 DB를 되돌린다(코어를 끈 상태에서)")
    restore_parser.add_argument("backup_file")
    restore_parser.add_argument("--db", default=None, help="기본은 서비스가 쓰는 DB")
    args = parser.parse_args(argv)
    return _run_make(args) if args.command == "make" else _run_restore(args)


if __name__ == "__main__":
    sys.exit(main())
