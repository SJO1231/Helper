import json

import jsonschema

from core.routes import handle
from core.tests.support import ROOT, capture_fields


def load(name):
    return json.loads((ROOT / "shared" / "schema" / name).read_text(encoding="utf-8"))


def validate(instance, name):
    jsonschema.Draft202012Validator(load(name)).validate(instance)


HEADERS = {"x-schema-version": "1", "x-request-id": "r1"}


def test_fixture_request_matches_capture_request_schema():
    validate(capture_fields(), "capture-request.schema.json")


def test_capture_and_records_responses_match_shared_schemas(seeded):
    status, body = handle(seeded, "POST", "/api/tables/g2b_capture/records", HEADERS,
                          {"records": [{"fields": capture_fields()}]})
    assert status == 200
    validate(body["records"][0]["fields"], "capture-result.schema.json")
    status, page = handle(seeded, "GET", "/api/tables/g2b_bid/records", HEADERS, None)
    validate(page, "records-page.schema.json")
    assert page["total"] == 1


def test_rejected_and_same_results_match_schema(seeded):
    for key_a, request_id in (("", "a"), ("V1", "b"), ("V1", "c")):
        headers = {**HEADERS, "x-request-id": request_id}
        _, body = handle(seeded, "POST", "/api/tables/g2b_capture/records", headers,
                         {"records": [{"fields": capture_fields(key_a=key_a)}]})
        validate(body["records"][0]["fields"], "capture-result.schema.json")


def test_dict_records_page_matches_schema(seeded):
    for table in ("dict_key", "dict_screen", "g2b_capture"):
        _, page = handle(seeded, "GET", f"/api/tables/{table}/records", HEADERS, None)
        validate(page, "records-page.schema.json")
