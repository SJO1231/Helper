"""DB의 유일한 접점. 이 파일만 SQL 드라이버를 부른다.
나머지 모듈은 run·rows·tx로만 DB를 만진다. 쓰기는 BEGIN IMMEDIATE로 줄을 서고 프로세스 안은 RLock이다."""
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

from core import capture_write, dict_write, read_api, schema_views, trash
from core.errors import BadRequest, NotFound, NotWritable, StorageError  # noqa: F401  (밖에서 여기서 가져다 쓴다)
from core.sql_query import digit_key, num_key
from core.sql_schema import create_statements, quote_ident

DEFAULT_DB_NAME = "helper.sqlite3"
SCHEMA_MODULE, SCHEMA_VERSION = "g2b", 1


class Gateway:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._depth = 0
        self._db = sqlite3.connect(str(self.path), isolation_level=None, check_same_thread=False, timeout=5.0)
        self._db.row_factory = sqlite3.Row
        self._db.create_function("num_key", 1, num_key, deterministic=True)
        self._db.create_function("digit_key", 1, digit_key, deterministic=True)
        self.run("PRAGMA busy_timeout = 5000")
        self.run("PRAGMA journal_mode = WAL")
        with self.tx():
            for statement in create_statements():
                self.run(statement)
            self.run("INSERT OR IGNORE INTO schema_version (module, version) VALUES (?, ?)",
                     (SCHEMA_MODULE, SCHEMA_VERSION))
            schema_views.rebuild(self)

    def close(self):
        with self._lock:
            self._db.close()

    def run(self, sql, params=()):
        with self._lock:
            try:
                return self._db.execute(sql, params)
            except sqlite3.IntegrityError as error:
                raise BadRequest(f"저장할 수 없는 값이다: {error}") from error
            except sqlite3.Error as error:
                raise StorageError(f"저장소 오류: {error}") from error

    def rows(self, sql, params=()):
        with self._lock:
            try:
                return [dict(row) for row in self._db.execute(sql, params).fetchall()]
            except sqlite3.Error as error:
                raise StorageError(f"저장소 오류: {error}") from error

    @contextmanager
    def tx(self):
        with self._lock:
            if self._depth:  # 안쪽 호출은 바깥 트랜잭션에 합류한다
                yield self
                return
            self.run("BEGIN IMMEDIATE")
            self._depth = 1
            try:
                yield self
                self.run("COMMIT")
            except BaseException:
                if self._db.in_transaction:
                    self._db.execute("ROLLBACK")
                raise
            finally:
                self._depth = 0

    def table_columns(self, table):
        return [row["name"] for row in self.rows(f"PRAGMA table_info({quote_ident(table)})")]

    def require_table(self, table):
        return read_api.require_table(self, table)

    def backup(self, dest):
        dest = Path(dest)
        if dest.exists():
            raise FileExistsError(f"이미 있는 파일이다: {dest}")
        with self._lock:  # VACUUM은 트랜잭션 밖에서만 돈다
            self.run("VACUUM INTO ?", (str(dest),))

    def add_records(self, table, records, request_id=None):
        return dict_write.add_records(self, table, records, request_id)

    def update_records(self, table, records, request_id=None):
        return dict_write.update_records(self, table, records, request_id)

    def upsert_records(self, table, records, noupdate=False, request_id=None):
        return dict_write.upsert_records(self, table, records, noupdate, request_id)

    def write_capture(self, fields, request_id):
        return capture_write.write_capture(self, fields, request_id)

    def list_tables(self):
        return read_api.list_tables(self)

    def list_columns(self, table):
        return read_api.list_columns(self, table)

    def list_records(self, table, sort=None, filters=None, limit=read_api.DEFAULT_LIMIT, offset=0):
        return read_api.list_records(self, table, sort, filters, limit, offset)

    def trash_record(self, table, record_id):
        return trash.trash_record(self, table, record_id)

    def restore_record(self, table, record_id):
        return trash.restore_record(self, table, record_id)
