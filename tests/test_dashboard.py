from tests.conftest import API, SOLUTION_ACCEPTED, SOLUTION_WRONG


def _submit(client, headers, problem_id, source):
    return client.post(
        f"{API}/submissions",
        headers=headers,
        json={
            "problem_id": problem_id,
            "language": "python",
            "source_code": source,
        },
    )


def test_dashboard_requires_authentication(client):
    assert client.get(f"{API}/dashboard").status_code == 401


def test_empty_dashboard_has_no_division_by_zero(client, user_headers):
    body = client.get(f"{API}/dashboard", headers=user_headers).json()
    assert body["total_submissions"] == 0
    assert body["acceptance_rate"] == 0.0
    assert body["problems_solved"] == 0


def test_statistics_reflect_submission_history(client, user_headers, problem_id):
    _submit(client, user_headers, problem_id, SOLUTION_ACCEPTED)
    _submit(client, user_headers, problem_id, SOLUTION_WRONG)
    _submit(client, user_headers, problem_id, SOLUTION_ACCEPTED)

    body = client.get(f"{API}/dashboard", headers=user_headers).json()

    assert body["total_submissions"] == 3
    assert body["accepted_submissions"] == 2
    assert body["acceptance_rate"] == round(2 * 100 / 3, 2)
    # Solved counts distinct problems, not accepted submissions.
    assert body["problems_solved"] == 1
    assert body["problems_attempted"] == 1


def test_breakdowns_are_populated(client, user_headers, problem_id):
    _submit(client, user_headers, problem_id, SOLUTION_ACCEPTED)
    _submit(client, user_headers, problem_id, SOLUTION_WRONG)

    body = client.get(f"{API}/dashboard", headers=user_headers).json()

    verdicts = {row["verdict"]: row["count"] for row in body["verdict_breakdown"]}
    assert verdicts["Accepted"] == 1
    assert verdicts["Wrong Answer"] == 1

    languages = {row["language"]: row for row in body["language_usage"]}
    assert languages["python"]["submissions"] == 2
    assert languages["python"]["accepted"] == 1

    difficulty = {row["difficulty"]: row for row in body["difficulty_progress"]}
    assert difficulty["Easy"]["solved"] == 1
    assert difficulty["Easy"]["total_available"] == 1

    assert len(body["recent_submissions"]) == 2


def test_statistics_are_scoped_to_the_caller(
    client, user_headers, admin_headers, problem_id
):
    _submit(client, user_headers, problem_id, SOLUTION_ACCEPTED)
    body = client.get(f"{API}/dashboard", headers=admin_headers).json()
    assert body["total_submissions"] == 0


def test_activity_streaks_and_topics(client, admin_headers, user_headers, problem_id):
    from tests.conftest import SOLUTION_ACCEPTED

    client.patch(f"{API}/problems/{problem_id}", headers=admin_headers, json={"tags": ["Math"]})
    client.post(f"{API}/submissions", headers=user_headers,
                json={"problem_id": problem_id, "language": "python", "source_code": SOLUTION_ACCEPTED})

    data = client.get(f"{API}/dashboard", headers=user_headers).json()
    assert len(data["activity"]) == 1
    assert data["activity"][0]["submissions"] == 1 and data["activity"][0]["accepted"] == 1
    assert data["current_streak"] == 1 and data["longest_streak"] == 1
    assert data["tag_progress"] == [{"slug": "math", "name": "Math", "solved": 1, "total": 1}]
