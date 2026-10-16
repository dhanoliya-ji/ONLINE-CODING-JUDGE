"""Output checkers and per-language time limits."""

import pytest

from app.execution.checkers import is_valid_checker, outputs_match
from app.execution.judge import effective_time_limit
from tests.conftest import API


@pytest.mark.parametrize("checker, expected, actual, ok", [
    ("exact", "1 2\n3\n", "1 2  \n3\n\n", True),
    ("exact", "1 2\n3\n", "1\n2 3\n", False),
    ("tokens", "1 2\n3\n", "1\n2 3", True),
    ("tokens", "1 2 3", "1 2", False),
    ("case_insensitive", "YES\nno", "yes NO", True),
    ("case_insensitive", "YES", "YESS", False),
    ("float:1e-6", "0.3333333333", "0.333333", True),
    ("float:1e-6", "1000000", "1000000.5", True),   # relative error 5e-7
    ("float:1e-6", "0.5", "0.51", False),
    ("float:1e-6", "3 abc", "3.0000001 abc", True),
    ("float:1e-6", "3 abc", "3 abd", False),
    ("float:1e-6", "1", "nan", False),
])
def test_checkers(checker, expected, actual, ok):
    assert outputs_match(expected, actual, checker) is ok


@pytest.mark.parametrize("name, valid", [
    ("exact", True), ("tokens", True), ("case_insensitive", True),
    ("float:1e-9", True), ("float:0.001", True), ("float:", False), ("diff", False),
])
def test_checker_names(name, valid):
    assert is_valid_checker(name) is valid


def test_slower_languages_get_more_time():
    assert effective_time_limit("cpp", 1000) == 1000
    assert effective_time_limit("python", 1000) == 3000
    assert effective_time_limit("java", 1000) == 2000
    assert effective_time_limit("python", 10_000) == 20_000  # capped


def test_problem_checker_is_validated_and_used(client, admin_headers, user_headers, problem_id):
    bad = client.patch(f"{API}/problems/{problem_id}", headers=admin_headers, json={"checker": "diff"})
    assert bad.status_code == 422

    ok = client.patch(f"{API}/problems/{problem_id}", headers=admin_headers, json={"checker": "tokens"})
    assert ok.json()["checker"] == "tokens"

    # Same numbers, one per line: wrong under "exact", accepted under "tokens".
    code = "a, b = map(int, input().split())\nprint(a + b)\nprint()\n"
    response = client.post(f"{API}/submissions", headers=user_headers,
                           json={"problem_id": problem_id, "language": "python", "source_code": code})
    assert response.json()["verdict"] == "Accepted"
