import json

import pytest

from core.dictionary import label_index, resolve_label, resolve_std_key
from core.tests.support import ROOT

CASES = json.loads((ROOT / "shared" / "fixtures" / "dictionary-cases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES["stdKeyCases"])
def test_python_matches_shared_std_key_cases(case):
    found = resolve_std_key(case["k"], case["screen"], CASES["aliases"], set(CASES["stdKeys"]))
    assert found == case["expect"]


@pytest.mark.parametrize("case", CASES["labelCases"])
def test_python_matches_shared_label_cases(case):
    index = label_index(CASES["labels"])
    assert resolve_label(index, case["key"], case["screen"], "g2b", case["screenL"]) == case["expect"]


def test_label_without_screen_skips_screen_scope():
    index = label_index(CASES["labels"])
    assert resolve_label(index, "keyF", None, "g2b", "x") == "site-F"
