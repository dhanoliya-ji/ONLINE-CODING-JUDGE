"""The practice coach: available in practice, refused during contests.

No test talks to a real AI provider: the HTTP call is replaced, and what the
coach would have sent is captured so the prompt can be checked.
"""

import httpx
import pytest

from app.config import settings
from app.services import coach as coach_service
from tests.conftest import API
from tests.test_contests import make_contest

ASK = {"messages": [{"role": "user", "content": "Can I get a hint?"}]}


@pytest.fixture
def sent(monkeypatch):
    """Configure a provider and record every prompt instead of sending it."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    calls = []

    def fake_ask(provider, messages):
        calls.append(messages)
        return "Think about what the sum of two numbers needs."

    monkeypatch.setattr(coach_service, "_ask", fake_ask)
    return calls


def test_practice_question_gets_a_reply(client, user_headers, problem_id, sent):
    body = {
        "messages": [{"role": "user", "content": "Why is this wrong?"}],
        "code": "print(a - b)",
        "language": "python",
        "verdict": "Wrong Answer on test 2",
    }
    response = client.post(f"{API}/problems/{problem_id}/coach", headers=user_headers, json=body)
    assert response.status_code == 200, response.text
    assert response.json()["reply"].startswith("Think about")
    assert response.json()["remaining_today"] == settings.COACH_DAILY_LIMIT - 1

    system = sent[0][0]
    assert system["role"] == "system"
    # The coach sees the problem, the student's code and their verdict.
    for expected in ("Sum of Two Numbers", "print(a - b)", "Wrong Answer on test 2"):
        assert expected in system["content"]
    assert sent[0][-1] == {"role": "user", "content": "Why is this wrong?"}


def test_status_reports_available_in_practice(client, user_headers, problem_id, sent):
    status = client.get(f"{API}/problems/{problem_id}/coach", headers=user_headers).json()
    assert status["available"] is True
    assert status["remaining_today"] == settings.COACH_DAILY_LIMIT


def test_signing_in_is_required(client, problem_id, sent):
    assert client.post(f"{API}/problems/{problem_id}/coach", json=ASK).status_code == 401
    status = client.get(f"{API}/problems/{problem_id}/coach").json()
    assert status["available"] is False
    assert "Sign in" in status["reason"]


def test_refused_for_a_problem_in_a_running_contest(
    client, admin_headers, user_headers, problem_id, sent
):
    contest = make_contest(client, admin_headers)
    client.post(f"{API}/contests/{contest['id']}/problems", headers=admin_headers,
                json={"problem_id": problem_id, "points": 100})

    response = client.post(f"{API}/problems/{problem_id}/coach", headers=user_headers, json=ASK)
    assert response.status_code == 403
    assert "contest" in response.json()["detail"]
    assert client.get(f"{API}/problems/{problem_id}/coach",
                      headers=user_headers).json()["available"] is False
    assert sent == [], "nothing may reach the AI provider during a contest"


def test_refused_for_a_problem_in_an_upcoming_contest(
    client, admin_headers, user_headers, problem_id, sent
):
    contest = make_contest(client, admin_headers, starts_in=60, ends_in=180)
    client.post(f"{API}/contests/{contest['id']}/problems", headers=admin_headers,
                json={"problem_id": problem_id, "points": 100})
    response = client.post(f"{API}/problems/{problem_id}/coach", headers=user_headers, json=ASK)
    assert response.status_code == 403


def test_available_again_once_the_contest_has_ended(
    client, admin_headers, user_headers, problem_id, sent
):
    contest = make_contest(client, admin_headers, starts_in=-180, ends_in=-60)
    client.post(f"{API}/contests/{contest['id']}/problems", headers=admin_headers,
                json={"problem_id": problem_id, "points": 100})
    response = client.post(f"{API}/problems/{problem_id}/coach", headers=user_headers, json=ASK)
    assert response.status_code == 200, response.text


def test_refused_for_anyone_competing_in_a_live_contest(
    client, admin_headers, user_headers, problem_id, sent
):
    # The contest does not even contain this problem: a contestant gets no AI
    # help at all until their contest ends.
    contest = make_contest(client, admin_headers)
    assert client.post(f"{API}/contests/{contest['id']}/join",
                       headers=user_headers).status_code == 201

    response = client.post(f"{API}/problems/{problem_id}/coach", headers=user_headers, json=ASK)
    assert response.status_code == 403
    assert "competing" in response.json()["detail"]


def test_daily_limit(client, user_headers, problem_id, sent, monkeypatch):
    monkeypatch.setattr(settings, "COACH_DAILY_LIMIT", 2)
    url = f"{API}/problems/{problem_id}/coach"
    assert client.post(url, headers=user_headers, json=ASK).json()["remaining_today"] == 1
    assert client.post(url, headers=user_headers, json=ASK).json()["remaining_today"] == 0
    response = client.post(url, headers=user_headers, json=ASK)
    assert response.status_code == 429
    assert len(sent) == 2


def test_unconfigured_coach_says_so(client, user_headers, problem_id, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    response = client.post(f"{API}/problems/{problem_id}/coach", headers=user_headers, json=ASK)
    assert response.status_code == 503
    status = client.get(f"{API}/problems/{problem_id}/coach", headers=user_headers).json()
    assert status["available"] is False


def test_falls_back_to_the_next_provider(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "groq-key")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "gemini-key")
    tried = []

    def fake_ask(provider, messages):
        tried.append(provider.name)
        if provider.name == "groq":
            raise httpx.HTTPStatusError("429", request=None, response=None)
        return "from gemini"

    monkeypatch.setattr(coach_service, "_ask", fake_ask)
    assert coach_service.complete([{"role": "user", "content": "hi"}]) == "from gemini"
    assert tried == ["groq", "gemini"]


def test_a_failed_reply_is_not_counted(client, user_headers, problem_id, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "groq-key")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")

    def down(provider, messages):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(coach_service, "_ask", down)
    response = client.post(f"{API}/problems/{problem_id}/coach", headers=user_headers, json=ASK)
    assert response.status_code == 503
    status = client.get(f"{API}/problems/{problem_id}/coach", headers=user_headers).json()
    assert status["remaining_today"] == settings.COACH_DAILY_LIMIT


def test_conversation_must_end_with_the_user(client, user_headers, problem_id, sent):
    body = {"messages": [{"role": "assistant", "content": "Hello"}]}
    response = client.post(f"{API}/problems/{problem_id}/coach", headers=user_headers, json=body)
    assert response.status_code == 422


def test_hidden_problems_stay_hidden(client, admin_headers, user_headers, problem_id, sent):
    client.patch(f"{API}/problems/{problem_id}", headers=admin_headers, json={"is_public": False})
    response = client.post(f"{API}/problems/{problem_id}/coach", headers=user_headers, json=ASK)
    assert response.status_code == 404
