# Screenshot capture checklist

The nine PNGs in this folder are **placeholders**. Replace each one with a real
capture, keeping the filename identical — the README links to these exact
paths, so no README edit is needed.

## Setup

```bash
cp .env.example .env                 # Windows: copy .env.example .env
# edit .env: set ADMIN_EMAILS to the address you will register with
pip install -r requirements.txt
python -m scripts.seed --reset       # 6 problems, 1 live contest, 2 accounts
uvicorn app.main:app --reload
```

Open <http://localhost:8000/docs>.

Sign in first: run `POST /api/v1/auth/login` with
`{"email": "admin@example.com", "password": "AdminPass123"}`, copy the
`access_token`, click **Authorize** at the top right and paste it. Every
subsequent call is then authenticated.

For `09-health-sandbox.png` start Docker Desktop first and set
`EXECUTION_BACKEND=docker` in `.env`, so the health payload reports the
container sandbox rather than the local fallback.

## Capture tips

- Use a **1280×720 or wider** window; the placeholders are 1280×720.
- Capture the **expanded response body**, not the collapsed row — the JSON is
  the evidence.
- Include the green `200`/`201` status line where it fits.
- On Windows, `Win + Shift + S` captures a region straight to the clipboard.

## The nine shots

| File | What to show | Endpoint |
|---|---|---|
| `01-swagger-overview.png` | All eight tag groups collapsed, so the full API surface is visible in one frame | `/docs` |
| `02-auth-register.png` | 201 response with `access_token`, `expires_in`, `user.is_admin: true` | `POST /auth/register` |
| `03-problem-list.png` | Paginated `items[]` with `total`, difficulty and `accepted_submissions` | `GET /problems` |
| `04-submission-accepted.png` | `verdict: "Accepted"`, `score: 100`, `passed_tests: 6`, timing and memory | `POST /submissions` |
| `05-submission-wrong-answer.png` | `failed_test_index`, plus a `test_results[]` sample entry with expected vs actual | `POST /submissions` |
| `06-verdict-matrix.png` | Three responses: Runtime Error, Time Limit Exceeded, Compilation Error | `POST /submissions` |
| `07-contest-leaderboard.png` | `rank`, `score`, `penalty` and per-problem cells | `GET /contests/1/leaderboard` |
| `08-dashboard.png` | `acceptance_rate`, `verdict_breakdown`, `difficulty_progress`, `language_usage` | `GET /dashboard` |
| `09-health-sandbox.png` | `execution.active: "docker"` and the `isolation` block | `GET /health` |

### Source snippets for the verdict shots

```python
# Accepted
a, b = map(int, input().split())
print(a + b)

# Wrong Answer
a, b = map(int, input().split())
print(a - b)

# Runtime Error
raise ValueError("boom")

# Time Limit Exceeded
while True:
    pass

# Compilation Error
def broken(:
```
