"""Tags, search, filters, sorting, facets, and the daily and random picks."""

import pytest

from tests.conftest import API, SOLUTION_ACCEPTED, SOLUTION_WRONG
from tests.test_contests import make_contest


def _problem(client, headers, title, difficulty="Easy", tags=(), description=None, **extra):
    response = client.post(
        f"{API}/problems",
        headers=headers,
        json={
            "title": title,
            "description": description or f"Statement for {title}.",
            "difficulty": difficulty,
            "input_format": "-",
            "output_format": "-",
            "constraints": "-",
            "sample_input": "2 3",
            "sample_output": "5",
            "tags": list(tags),
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    pid = response.json()["id"]
    client.post(
        f"{API}/testcases/problem/{pid}/bulk",
        headers=headers,
        json={"test_cases": [{"input_data": "2 3", "expected_output": "5", "is_sample": True}]},
    )
    return response.json()


@pytest.fixture
def catalogue(client, admin_headers):
    return {
        "knapsack": _problem(client, admin_headers, "Knapsack", "Medium",
                             ["Dynamic Programming"],
                             description="Pack items into a bag to maximise value."),
        "paths": _problem(client, admin_headers, "Shortest Paths", "Hard",
                          ["Graphs", "Dynamic Programming"],
                          description="Find the cheapest route through a weighted graph."),
        "coins": _problem(client, admin_headers, "Coin Change", "Easy",
                          ["Greedy", "dynamic programming"],
                          source="Codeforces", source_url="https://codeforces.com/x",
                          license="CC BY 4.0"),
    }


def _titles(response):
    assert response.status_code == 200, response.text
    return [item["title"] for item in response.json()["items"]]


def test_tags_are_created_once_and_shared(client, catalogue):
    # "dynamic programming" and "Dynamic Programming" are the same tag.
    assert [t["slug"] for t in catalogue["coins"]["tags"]] == ["dynamic-programming", "greedy"]
    facets = client.get(f"{API}/problems/facets").json()
    counts = {t["slug"]: t["problem_count"] for t in facets["tags"]}
    assert counts == {"dynamic-programming": 3, "graphs": 1, "greedy": 1}
    assert facets["sources"] == {"Codeforces": 1}
    assert facets["difficulties"] == {"Easy": 1, "Medium": 1, "Hard": 1}


def test_filter_by_tags_requires_all_of_them(client, catalogue):
    assert sorted(_titles(client.get(f"{API}/problems?tags=dynamic-programming"))) == [
        "Coin Change", "Knapsack", "Shortest Paths"]
    assert _titles(client.get(f"{API}/problems?tags=dynamic-programming,graphs")) == ["Shortest Paths"]


def test_filter_by_several_difficulties(client, catalogue):
    titles = _titles(client.get(f"{API}/problems?difficulty=Easy&difficulty=Hard"))
    assert sorted(titles) == ["Coin Change", "Shortest Paths"]


def test_search_reaches_into_the_statement(client, catalogue):
    assert _titles(client.get(f"{API}/problems?search=weighted")) == ["Shortest Paths"]
    assert _titles(client.get(f"{API}/problems?search=knap")) == ["Knapsack"]


def test_sort_by_difficulty_and_title(client, catalogue):
    assert _titles(client.get(f"{API}/problems?sort=difficulty")) == [
        "Coin Change", "Knapsack", "Shortest Paths"]
    assert _titles(client.get(f"{API}/problems?sort=title&order=desc")) == [
        "Shortest Paths", "Knapsack", "Coin Change"]


def test_provenance_is_returned(client, catalogue):
    problem = client.get(f"{API}/problems/{catalogue['coins']['slug']}").json()
    assert problem["source"] == "Codeforces"
    assert problem["source_url"] == "https://codeforces.com/x"
    assert problem["license"] == "CC BY 4.0"


def _submit(client, headers, problem_id, code):
    response = client.post(f"{API}/submissions", headers=headers,
                           json={"problem_id": problem_id, "language": "python", "source_code": code})
    assert response.status_code in (200, 201), response.text


def test_status_filter_and_acceptance(client, user_headers, catalogue):
    knapsack, paths = catalogue["knapsack"]["id"], catalogue["paths"]["id"]
    _submit(client, user_headers, knapsack, SOLUTION_ACCEPTED)
    _submit(client, user_headers, paths, SOLUTION_WRONG)

    get = lambda status: _titles(client.get(f"{API}/problems?status={status}", headers=user_headers))  # noqa: E731
    assert get("solved") == ["Knapsack"]
    assert get("attempted") == ["Shortest Paths"]
    assert get("todo") == ["Coin Change"]
    # The total reflects the filter, not the unfiltered count.
    assert client.get(f"{API}/problems?status=todo", headers=user_headers).json()["total"] == 1

    by_acceptance = client.get(f"{API}/problems?sort=acceptance&order=desc").json()["items"]
    assert [p["title"] for p in by_acceptance] == ["Knapsack", "Shortest Paths", "Coin Change"]
    assert [p["acceptance_rate"] for p in by_acceptance] == [100.0, 0.0, None]


def test_tags_can_be_replaced(client, admin_headers, catalogue):
    pid = catalogue["knapsack"]["id"]
    response = client.patch(f"{API}/problems/{pid}", headers=admin_headers, json={"tags": ["Math"]})
    assert [t["name"] for t in response.json()["tags"]] == ["Math"]


def test_daily_problem_is_stable_and_skips_contest_problems(client, admin_headers, catalogue):
    first = client.get(f"{API}/problems/daily").json()
    assert client.get(f"{API}/problems/daily").json()["id"] == first["id"]

    # Put two of the three problems in a running contest: the daily pick
    # must be the one left over.
    contest = make_contest(client, admin_headers)
    free = catalogue["coins"]["id"]
    for key in ("knapsack", "paths"):
        client.post(f"{API}/contests/{contest['id']}/problems", headers=admin_headers,
                    json={"problem_id": catalogue[key]["id"], "points": 100})
    assert client.get(f"{API}/problems/daily").json()["id"] == free


def test_random_respects_filters_and_skips_solved(client, user_headers, catalogue):
    pick = client.get(f"{API}/problems/random?tags=graphs").json()
    assert pick["title"] == "Shortest Paths"

    _submit(client, user_headers, catalogue["paths"]["id"], SOLUTION_ACCEPTED)
    response = client.get(f"{API}/problems/random?tags=graphs", headers=user_headers)
    assert response.status_code == 404
    response = client.get(f"{API}/problems/random?tags=graphs&unsolved=false", headers=user_headers)
    assert response.json()["title"] == "Shortest Paths"
