"""코어 밖으로 나가는 오류. status는 HTTP 상태다."""


class CoreError(Exception):
    status = 500


class BadRequest(CoreError, ValueError):
    status = 400


class NotFound(CoreError):
    status = 404


class Conflict(CoreError):
    status = 409


class NotWritable(CoreError):
    status = 405


class StorageError(CoreError):
    status = 500
