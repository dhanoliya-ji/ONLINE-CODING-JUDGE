"""The global leaderboard."""

from tests.conftest import API, SOLUTION_ACCEPTED, SOLUTION_WRONG


def _register(client, name):
    response = client.post(f"{API}/auth/register",
                           json={"username": name, "email": f"{name}@example.com", "password": "Passw0rd!x"})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _submit(client, headers, problem_id, code):
    client.post(f"{API}/submissions", headers=headers,
                json={"problem_id": problem_id, "language": "python", "source_code": code})


def test_ranked_by_solved_then_fewer_submissions(client, problem_id):
    ann, bob, cat = _register(client, "ann"), _register(client, "bob"), _register(client, "cat")
    _submit(client, ann, problem_id, SOLUTION_WRONG)
    _submit(client, ann, problem_id, SOLUTION_ACCEPTED)
    _submit(client, bob, problem_id, SOLUTION_ACCEPTED)
    _submit(client, bob, problem_id, SOLUTION_ACCEPTED)  # solving twice counts once
    _submit(client, cat, problem_id, SOLUTION_WRONG)     # nothing solved: not listed

    page = client.get(f"{API}/leaderboard").json()
    assert page["total"] == 2
    assert [(r["rank"], r["username"], r["solved"], r["easy"]) for r in page["items"]] == [
        (1, "ann", 1, 1), (2, "bob", 1, 1)]
    assert page["items"][0]["acceptance_rate"] == 50.0
