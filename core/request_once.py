"""같은 요청 ID가 다시 오면 저장해 둔 응답을 그대로 준다(SPEC 4.1)."""
import json

from core.errors import Conflict


def once(db, request_id, fingerprint, produce):
    """produce()는 (응답, 기록할지)를 돌려준다. 거절·변화 없음은 기록하지 않아 다시 보내면 다시 판단한다."""
    with db.tx():
        if request_id is None:
            return produce()[0]
        saved = db.rows("SELECT fingerprint, response FROM request_log WHERE request_id = ?", (request_id,))
        if saved:
            if saved[0]["fingerprint"] != fingerprint:
                raise Conflict("같은 요청 ID에 다른 내용이 왔다")
            return json.loads(saved[0]["response"])
        response, remember = produce()
        if remember:
            db.run("INSERT INTO request_log (request_id, fingerprint, response) VALUES (?, ?, ?)",
                   (request_id, fingerprint, json.dumps(response, ensure_ascii=False)))
        return response

