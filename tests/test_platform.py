"""Ratings, weekly and virtual contests, discussions, lists, editorials, badges."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import Contest, Problem, RatingChange, Submission, User
from app.models.base import utcnow
from app.services import coach as coach_service
from app.services.contest_lifecycle import maintain, next_weekly_start, schedule_weekly
from app.services.rating import Standing, rating_changes
from tests.conftest import API, SOLUTION_ACCEPTED, SOLUTION_WRONG
from tests.test_contests import make_contest


def _register(client, name):
    response = client.post(f"{API}/auth/register",
                           json={"username": name, "email": f"{name}@example.com", "password": "Passw0rd!x"})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _submit(client, headers, problem_id, code, contest_id=None):
    body = {"problem_id": problem_id, "language": "python", "source_code": code}
    if contest_id:
        body["contest_id"] = contest_id
    response = client.post(f"{API}/submissions", headers=headers, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _shift_contest(contest_id, start, end):
    with SessionLocal() as db:
        contest = db.get(Contest, contest_id)
        contest.start_time, contest.end_time = start, end
        db.commit()


# ------------------------------------------------------------------ rating
class TestRatingMaths:
    def test_winner_gains_and_loser_loses(self):
        new = rating_changes([Standing(1, 1, 1500), Standing(2, 2, 1500)])
        assert new[1] > 1500 > new[2]

    def test_upset_moves_more_than_expected_result(self):
        upset = rating_changes([Standing(1, 1, 1200), Standing(2, 2, 1800)])
        expected = rating_changes([Standing(1, 1, 1800), Standing(2, 2, 1200)])
        assert upset[1] - 1200 > expected[1] - 1800

    def test_ties_share_the_change(self):
        new = rating_changes([Standing(1, 1, 1500), Standing(2, 1, 1500), Standing(3, 3, 1500)])
        assert new[1] == new[2] > new[3]

    def test_no_inflation(self):
        standings = [Standing(i, i, 1400 + 37 * i) for i in range(1, 30)]
        new = rating_changes(standings)
        assert sum(new[s.user_id] - s.rating for s in standings) <= 0

    def test_a_lone_participant_is_unchanged(self):
        assert rating_changes([Standing(1, 1, 1600)]) == {1: 1600}


def test_ended_contest_is_rated_once(client, admin_headers, problem_id):
    contest = make_contest(client, admin_headers)
    client.post(f"{API}/contests/{contest['id']}/problems", headers=admin_headers,
                json={"problem_id": problem_id, "points": 100})
    ann, bob = _register(client, "ann"), _register(client, "bob")
    for headers in (ann, bob):
        client.post(f"{API}/contests/{contest['id']}/join", headers=headers)
    _submit(client, ann, problem_id, SOLUTION_ACCEPTED, contest["id"])
    _submit(client, bob, problem_id, SOLUTION_WRONG, contest["id"])

    # End the contest just after those submissions.
    _shift_contest(contest["id"], utcnow() - timedelta(hours=2), utcnow())
    with SessionLocal() as db:
        maintain(db, force=True)
        maintain(db, force=True)  # idempotent
        users = {u.username: u for u in db.scalars(select(User).where(User.username.in_(["ann", "bob"])))}
        assert users["ann"].rating > 1500 > users["bob"].rating
        assert db.scalar(select(Contest).where(Contest.id == contest["id"])).finalized_at is not None
        assert len(list(db.scalars(select(RatingChange)))) == 2

    profile = client.get(f"{API}/dashboard", headers=ann).json()
    assert profile["rating"] == users["ann"].rating
    assert profile["rating_history"][0]["rank"] == 1


# ------------------------------------------------------------------ weekly
def _library(n_each=2):
    """Imported-looking problems the scheduler may use."""
    with SessionLocal() as db:
        for level in ("Easy", "Medium", "Hard"):
            for k in range(n_each):
                db.add(Problem(title=f"{level} import {k}", slug=f"{level.lower()}-import-{k}",
                               description="d" * 50, difficulty=level, input_format="-", output_format="-",
                               constraints="-", sample_input="1", sample_output="1",
                               external_id=f"codeforces/{level}/{k}", is_public=True))
        db.commit()


def test_next_weekly_start_is_a_sunday_afternoon():
    start = next_weekly_start(utcnow())
    assert start.weekday() == 6 and start.hour == 14
    assert timedelta(days=1) <= start - utcnow() <= timedelta(days=8)


def test_weekly_round_is_scheduled_with_sealed_problems(client, user_headers):
    _library()
    with SessionLocal() as db:
        contest = schedule_weekly(db)
        assert contest is not None and contest.is_auto
        assert schedule_weekly(db) is None  # one upcoming round at a time
        slugs = [link.problem.slug for link in contest.problem_links]
        assert [link.problem.difficulty for link in contest.problem_links] == ["Easy", "Medium", "Medium", "Hard"]
        contest_id = contest.id

    # Sealed until the start: not readable, and their samples are not either.
    assert client.get(f"{API}/problems/{slugs[0]}", headers=user_headers).status_code == 404

    now = utcnow()
    _shift_contest(contest_id, now - timedelta(minutes=5), now + timedelta(minutes=85))
    assert client.get(f"{API}/problems/{slugs[0]}", headers=user_headers).status_code == 200

    # After the round they join the public library.
    _shift_contest(contest_id, now - timedelta(hours=3), now - timedelta(hours=1))
    with SessionLocal() as db:
        maintain(db, force=True)
    listed = {p["slug"] for p in client.get(f"{API}/problems?limit=100").json()["items"]}
    assert set(slugs) <= listed


# ----------------------------------------------------------------- virtual
def test_virtual_contest(client, admin_headers, user_headers, problem_id, monkeypatch):
    contest = make_contest(client, admin_headers, starts_in=-180, ends_in=-60)
    client.post(f"{API}/contests/{contest['id']}/problems", headers=admin_headers,
                json={"problem_id": problem_id, "points": 100})
    rival = _register(client, "rival")

    # Only finished contests can be replayed.
    live = make_contest(client, admin_headers, title="Live round")
    assert client.post(f"{API}/contests/{live['id']}/virtual", headers=rival).status_code == 409

    started = client.post(f"{API}/contests/{contest['id']}/virtual", headers=user_headers)
    assert started.status_code == 201 and started.json()["active"]
    assert client.post(f"{API}/contests/{contest['id']}/virtual", headers=user_headers).status_code == 409

    submission = _submit(client, user_headers, problem_id, SOLUTION_ACCEPTED, contest["id"])
    with SessionLocal() as db:
        assert db.get(Submission, submission["id"]).is_virtual

    status_ = client.get(f"{API}/contests/{contest['id']}/virtual", headers=user_headers).json()
    assert status_["entry"]["solved"] == 1 and status_["virtual_rank"] == 1
    # The real standings never see a replay.
    board = client.get(f"{API}/contests/{contest['id']}/leaderboard").json()
    assert board["total_participants"] == 0

    # No coach during a replay.
    monkeypatch.setattr(settings, "GROQ_API_KEY", "key")
    coach = client.get(f"{API}/problems/{problem_id}/coach", headers=user_headers).json()
    assert coach["available"] is False and "virtual" in coach["reason"]


# ------------------------------------------------------------- discussions
def test_discussion_thread_reply_vote_edit_delete(client, user_headers, problem_id):
    url = f"{API}/problems/{problem_id}/discussions"
    thread = client.post(url, headers=user_headers, json={"body": "Try sorting first?"}).json()
    other = _register(client, "other")
    reply = client.post(url, headers=other, json={"body": "Works, O(n log n).", "parent_id": thread["id"]})
    assert reply.status_code == 201

    # Replies attach to threads only, one level deep.
    nested = client.post(url, headers=other, json={"body": "x", "parent_id": reply.json()["id"]})
    assert nested.status_code == 400

    vote = client.post(f"{API}/discussions/{thread['id']}/vote", headers=other).json()
    assert vote == {"votes": 1, "voted_by_me": True}
    assert client.post(f"{API}/discussions/{thread['id']}/vote", headers=other).json()["votes"] == 0

    assert client.patch(f"{API}/discussions/{thread['id']}", headers=other, json={"body": "hijack"}).status_code == 403
    client.patch(f"{API}/discussions/{thread['id']}", headers=user_headers, json={"body": "Sort, then sweep."})

    page = client.get(url).json()
    assert page["total"] == 1
    assert page["items"][0]["body"] == "Sort, then sweep."
    assert page["items"][0]["replies"][0]["author"] == "other"

    client.delete(f"{API}/discussions/{thread['id']}", headers=user_headers)
    assert client.get(url).json()["items"][0]["body"] is None  # kept in place, text gone


def test_discussions_hidden_during_a_live_contest(client, admin_headers, user_headers, problem_id):
    contest = make_contest(client, admin_headers)
    client.post(f"{API}/contests/{contest['id']}/problems", headers=admin_headers,
                json={"problem_id": problem_id, "points": 100})
    url = f"{API}/problems/{problem_id}/discussions"
    assert client.get(url).status_code == 403
    assert client.post(url, headers=user_headers, json={"body": "answer is 42"}).status_code == 403


# ------------------------------------------------------------------- lists
def test_problem_lists(client, user_headers, problem_id):
    lists = client.get(f"{API}/lists", headers=user_headers).json()
    assert [entry["name"] for entry in lists] == ["Bookmarks"]
    bookmarks = lists[0]["id"]

    assert client.put(f"{API}/lists/{bookmarks}/problems/{problem_id}", headers=user_headers).status_code == 200
    client.put(f"{API}/lists/{bookmarks}/problems/{problem_id}", headers=user_headers)  # idempotent
    assert client.get(f"{API}/lists/containing/{problem_id}", headers=user_headers).json() == [bookmarks]
    page = client.get(f"{API}/lists/{bookmarks}/problems", headers=user_headers).json()
    assert page["total"] == 1 and page["items"][0]["id"] == problem_id

    custom = client.post(f"{API}/lists", headers=user_headers, json={"name": "Graphs to redo"})
    assert custom.status_code == 201
    assert client.post(f"{API}/lists", headers=user_headers, json={"name": "Graphs to redo"}).status_code == 409

    # Other people's lists do not exist, as far as you can tell.
    other = _register(client, "nosy")
    assert client.get(f"{API}/lists/{bookmarks}/problems", headers=other).status_code == 404

    client.delete(f"{API}/lists/{bookmarks}/problems/{problem_id}", headers=user_headers)
    assert client.get(f"{API}/lists/containing/{problem_id}", headers=user_headers).json() == []


# -------------------------------------------------------------- editorials
@pytest.fixture
def llm(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    calls = []

    def fake_ask(provider, messages):
        calls.append(messages)
        return "## Key idea\nAdd the numbers."

    monkeypatch.setattr(coach_service, "_ask", fake_ask)
    return calls


def test_editorial_is_drafted_once_from_the_reference(client, user_headers, problem_id, llm):
    with SessionLocal() as db:
        db.get(Problem, problem_id).reference_solution = SOLUTION_ACCEPTED
        db.commit()

    url = f"{API}/problems/{problem_id}/editorial"
    assert client.get(url).status_code == 401  # drafting needs a signed-in reader
    first = client.get(url, headers=user_headers)
    assert first.status_code == 200 and first.json()["body"].startswith("## Key idea")
    assert "print(a + b)" in llm[0][1]["content"]  # grounded in the verified solution
    client.get(url)  # now cached: anyone can read it, no new AI call
    assert len(llm) == 1


def test_editorial_needs_a_reference_and_no_live_contest(client, admin_headers, user_headers, problem_id, llm):
    url = f"{API}/problems/{problem_id}/editorial"
    assert client.get(url, headers=user_headers).status_code == 404

    contest = make_contest(client, admin_headers)
    client.post(f"{API}/contests/{contest['id']}/problems", headers=admin_headers,
                json={"problem_id": problem_id, "points": 100})
    assert client.get(url, headers=user_headers).status_code == 403


# ------------------------------------------------------------------ badges
def test_badges(client, user_headers, problem_id):
    _submit(client, user_headers, problem_id, SOLUTION_ACCEPTED)
    badges = {b["id"]: b for b in client.get(f"{API}/dashboard", headers=user_headers).json()["badges"]}
    assert badges["first-ac"]["earned"]
    assert not badges["solved-10"]["earned"] and badges["solved-10"]["progress"] == 0.1
