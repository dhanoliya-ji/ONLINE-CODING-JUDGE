<div align="center">

# Online Coding Judge

**A competitive-programming judge backend that compiles, sandboxes and grades untrusted code.**

Users solve problems, submit in Python, C++ or Java, and get a verdict in the same HTTP response —
graded against sample and hidden test suites inside an isolated sandbox with hard time, memory,
CPU and process limits.

[![CI](https://github.com/dhanoliya-ji/online-coding-judge/actions/workflows/ci.yml/badge.svg)](https://github.com/dhanoliya-ji/online-coding-judge/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-sandbox-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/tests-66%20passing-brightgreen)](#testing)

[Live demo](#-live-demo) · [Quick start](#-quick-start) · [API reference](#-api-reference) ·
[Architecture](#-architecture) · [Security model](#-security-model) · [Deployment](#-deployment)

</div>

---

## Table of contents

1. [Live demo](#-live-demo)
2. [Screenshots](#-screenshots)
3. [Why this project is interesting](#-why-this-project-is-interesting)
4. [Features](#-features)
5. [Architecture](#-architecture)
6. [The judging pipeline](#-the-judging-pipeline)
7. [Security model](#-security-model)
8. [Data model](#-data-model)
9. [Tech stack](#-tech-stack)
10. [Project structure](#-project-structure)
11. [Quick start](#-quick-start)
12. [Free hosted database (Neon)](#-free-hosted-database-neon)
13. [Deployment](#-deployment)
14. [Configuration reference](#-configuration-reference)
15. [API reference](#-api-reference)
16. [Verdict reference](#-verdict-reference)
17. [Testing](#-testing)
18. [Design decisions](#-design-decisions)
19. [Known limitations](#-known-limitations)
20. [Roadmap](#-roadmap)
21. [Author](#-author)

---

## 🌐 Live demo

| | |
|---|---|
| **API root** | `https://<your-service>.onrender.com/` |
| **Interactive docs** | `https://<your-service>.onrender.com/docs` |
| **Health / sandbox report** | `https://<your-service>.onrender.com/api/v1/health` |

> **Replace `<your-service>` with your Render URL after following
> [Deployment](#-deployment).** The database is a free Neon Postgres instance and
> the app is a free Render web service.

**Demo credentials** (created by `python -m scripts.seed`):

| Role | Email | Password |
|---|---|---|
| Regular user | `demo@example.com` | `DemoPass123` |

> 🔑 **The admin password is deliberately not published.** These seed defaults
> are fine locally, but anything reachable from the internet must not use a
> password that is committed to a public repository. Override them when
> seeding a live database:
>
> ```bash
> SEED_ADMIN_PASSWORD='...' SEED_DEMO_PASSWORD='...' python -m scripts.seed --reset
> ```
>
> To change an account that already exists, without dropping your data:
>
> ```bash
> python scripts/set_password.py you@example.com
> ```

> ⏱️ **Free-tier cold start.** Render spins an idle free service down after
> ~15 minutes. The first request after a nap takes **40–60 seconds**; every
> request after that is fast. Hit `/api/v1/ping` once to wake it before a demo.

> 🔒 **Sandbox on the live demo.** Free hosting does not expose a Docker socket,
> so the deployed instance runs the `local` (rlimit) backend rather than the
> container sandbox. Run `docker compose up` locally to exercise the full
> container isolation described in [Security model](#-security-model). The
> `/api/v1/health` endpoint always reports which backend is actually active —
> the project never claims isolation it is not providing.

---

## 📸 Screenshots

> The images below are **placeholders**. Follow
> [`docs/screenshots/CAPTURE.md`](docs/screenshots/CAPTURE.md) and overwrite each
> file with your own capture, keeping the filenames identical.

### The full API surface

![Swagger UI showing all endpoint groups](docs/screenshots/01-swagger-overview.png)

### Registration issues a JWT

![Register response containing an access token](docs/screenshots/02-auth-register.png)

### Problem catalogue with per-user progress

![Paginated problem list](docs/screenshots/03-problem-list.png)

### A correct submission: Accepted, with real metrics

![Accepted verdict with timing and memory](docs/screenshots/04-submission-accepted.png)

### A wrong submission: the failing sample case is diffed

![Wrong Answer showing expected vs actual output](docs/screenshots/05-submission-wrong-answer.png)

### Runtime Error, Time Limit Exceeded and Compilation Error

![Three failure verdicts](docs/screenshots/06-verdict-matrix.png)

### Contest leaderboard with ICPC-style penalties

![Score-ranked leaderboard](docs/screenshots/07-contest-leaderboard.png)

### Per-user dashboard analytics

![Dashboard with acceptance rate and breakdowns](docs/screenshots/08-dashboard.png)

### Health endpoint reporting the active sandbox

![Health response showing the Docker backend and its isolation settings](docs/screenshots/09-health-sandbox.png)

---

## 💡 Why this project is interesting

Running code a stranger wrote, on your server, and returning a trustworthy
verdict is the whole problem. Nearly everything here follows from that:

- **Untrusted code must not escape.** Every submission is executed with the
  network disabled, a hard memory ceiling, a CPU quota, a process cap, a
  read-only root filesystem, all Linux capabilities dropped, and a wall-clock
  timeout enforced from outside the sandbox. See [Security model](#-security-model).
- **A verdict must be reproducible.** Output comparison is normalised for
  trailing whitespace and line endings, so a stray newline never fails a correct
  solution and a whitespace trick never passes a wrong one.
- **The answer key must stay secret.** Hidden test data is never serialised into
  any response. Sample cases are diffed back to the user because that data was
  already public on the problem page.
- **Contest scoring must be hard to game.** Points are awarded once per problem
  on first solve, only for submissions scoped to the contest and made inside its
  window, with an ICPC-style time-plus-attempt penalty.

The execution engine is **pluggable**: a `SandboxBackend` interface with a
Docker implementation and an rlimit-subprocess implementation, selected at
startup. That is what lets the same codebase provide genuine container
isolation locally and still deploy to a free host that forbids it.

---

## ✨ Features

<table>
<tr><td width="50%" valign="top">

**Authentication & authorisation**
- Registration and login issuing JWTs
- bcrypt password hashing (cost factor 12)
- Role-based access control: admin vs user
- Timing-equalised login (no user enumeration)
- Password strength rules and a bcrypt 72-byte guard
- Swagger **Authorize** integration

**Problems**
- Full CRUD, admin-gated
- Slug URLs (`/problems/sum-of-two-numbers`)
- Search, difficulty filter, pagination
- Per-problem time and memory limits
- Draft/published visibility
- Per-user `solved_by_me` / `attempted_by_me`
- Aggregate acceptance counts

**Test cases**
- Sample and hidden suites
- Bulk upload with optional replace
- **Hidden data never leaves the server**
- Explicit ordering; samples judged first

</td><td width="50%" valign="top">

**Submissions & judging**
- Python 3.11, C++17 (GCC), Java 21
- Seven verdicts including Compilation Error and MLE
- Real execution time and peak memory
- Per-test breakdown; diffs for samples only
- `POST /submissions/run` for scratch runs
- Source code private to its author
- Filterable history

**Contests**
- CRUD, registration, withdrawal
- Derived state: Upcoming / Running / Ended
- Problems hidden until the contest starts
- Window and registration enforced on submit
- Labels (A, B, C…) and per-problem points
- Leaderboard with ICPC penalty and tie-aware ranks

**Operations**
- `/health` reporting DB and sandbox status
- Structured error envelopes
- Request timing header
- Seed data: 6 problems, 1 contest, 2 accounts
- 66 automated tests, GitHub Actions CI
- Docker, Compose and Render blueprints

</td></tr>
</table>

---

## 🏗 Architecture

```mermaid
flowchart TB
    Client["Client<br/>(Swagger UI · curl · frontend)"]

    subgraph API["FastAPI application"]
        MW["Middleware<br/>CORS · timing · error envelopes"]
        Deps["Dependencies<br/>get_db · get_current_user · get_current_admin"]

        subgraph Routers["Routers — 7 resource domains"]
            R1["auth"]
            R2["problems"]
            R3["test_cases"]
            R4["submissions"]
            R5["contests"]
            R6["contest_problems"]
            R7["dashboard"]
        end

        subgraph Services["Service layer"]
            S1["leaderboard<br/>scoring · penalties · ranks"]
            S2["stats<br/>SQL aggregates"]
        end
    end

    subgraph Engine["Execution engine"]
        J["judge<br/>orders tests · reduces to a verdict"]
        Sel{"backend<br/>selector"}
        D["DockerBackend<br/>container per run"]
        L["LocalBackend<br/>POSIX rlimits"]
    end

    DB[("PostgreSQL<br/>7 tables")]
    Ctr["Throw-away container<br/>no network · 128 MB · 50% CPU<br/>read-only rootfs · caps dropped"]

    Client --> MW --> Deps --> Routers
    Routers --> Services
    Routers --> DB
    Services --> DB
    R4 --> J --> Sel
    Sel -->|"daemon reachable"| D --> Ctr
    Sel -->|"fallback"| L
```

### Request lifecycle for a submission

```mermaid
sequenceDiagram
    participant U as User
    participant A as API
    participant DB as PostgreSQL
    participant J as Judge
    participant S as Sandbox

    U->>A: POST /submissions {problem_id, language, source}
    A->>A: Verify JWT, load user
    A->>DB: Load problem + its limits
    alt contest submission
        A->>DB: Check registration, window, problem membership
    end
    A->>DB: Load test cases
    A->>DB: INSERT submission (status=Running)
    Note over A,DB: Persisted BEFORE judging, so a crash<br/>leaves an auditable row, not a lost attempt

    A->>J: judge(source, language, tests, limits)
    loop Samples first, then hidden — stop at first failure
        J->>S: Compile (if needed), then run one test
        S-->>J: stdout, stderr, exit code, ms, KB
        J->>J: Normalise output and compare
    end
    J-->>A: verdict, score, peak time/memory, failing index

    A->>DB: UPDATE submission with the result
    A-->>U: 201 with verdict + per-test breakdown<br/>(hidden test data redacted)
```

---

## ⚡ The judging pipeline

**1 — Ordering.** Sample cases run first, then hidden ones by `order_index`,
then by id. A submission that fails the worked example fails after *one*
execution instead of burning the entire hidden suite.

**2 — Compilation.** Compiled languages build in a separate step with its own
timeout and extra memory headroom. A failure here is a **Compilation Error**,
distinct from a Runtime Error. Python is byte-compiled with `py_compile` first,
so a `SyntaxError` is also reported as a Compilation Error rather than a
confusing runtime traceback.

**3 — Execution.** Each test runs in a fresh sandbox with the problem's own
time and memory limits. stdin comes from the test input; stdout and stderr are
captured **separately** — merging them (as the original implementation did)
causes a program that logs to stderr to fail with a spurious Wrong Answer.

**4 — Comparison.** Both sides are normalised: CRLF → LF, trailing whitespace
stripped per line, trailing blank lines removed. Internal blank lines and
leading whitespace remain significant.

**5 — Reduction.** Evaluation stops at the first non-accepted case, bounding
worst-case cost. Reported time and memory are the **peak across tests**, not the
sum — a per-submission limit is measured against the worst single run.

**6 — Scoring.** `score = round(passed / total × 100)`.

**7 — Redaction.** Hidden cases contribute only an index and metrics to the
response. Sample cases carry a full input/expected/actual diff.

---

## 🔒 Security model

### Sandbox isolation

The Docker backend creates one throw-away container **per execution**:

| Control | Setting | What it stops |
|---|---|---|
| Network | `network_disabled=True` | Exfiltration, callbacks, abusing your host as a proxy |
| Memory | `mem_limit=128m`, `memswap_limit=128m` | Memory exhaustion; swap pinned to the cap so it cannot be escaped by swapping |
| CPU | `cpu_quota=50000 / cpu_period=100000` | One submission monopolising a core |
| Processes | `pids_limit=64` | Fork bombs |
| Filesystem | `read_only=True` + `tmpfs /tmp` (noexec, nosuid) | Tampering with the image; writing executables to disk |
| Privileges | `cap_drop=["ALL"]`, `no-new-privileges` | Capability abuse and setuid escalation |
| Identity | `user=65534:65534` (`nobody`) | Anything that requires root inside the container |
| Wall clock | Host-side `wait(timeout)`, then `kill` | Programs that ignore or outlive an internal timer |
| Output | 64 KB cap, then Output Limit Exceeded | Filling disk or memory with a print loop |
| Source mount | `ro` during execution | The program rewriting its own inputs |

Compilation and execution run in **separate containers** — the compile step
gets a writable mount, the run step a read-only one. That split is what makes
Compilation Error a distinguishable verdict.

Peak memory is sampled from the live Docker stats stream by a monitor thread,
and OOM kills are detected via the container's `State.OOMKilled` flag.

### The local backend, stated plainly

Where no Docker daemon is reachable, `LocalBackend` applies POSIX `rlimit`
ceilings in the child process before `exec`: `RLIMIT_AS` (memory), `RLIMIT_CPU`,
`RLIMIT_NPROC` (fork bombs), `RLIMIT_FSIZE`, and `RLIMIT_CORE=0`. The child gets
its own process group so a timeout kills the whole tree, and a deliberately
minimal environment.

**This is meaningfully weaker than the container sandbox.** There is no network
namespace and no filesystem namespace — submitted code can read files the API
process can read and open sockets. It exists so the project is demonstrable on
free hosting. **Do not run it on a public deployment with real users.**
`GET /api/v1/health` always reports which backend is live.

> One deliberate detail: Java skips `RLIMIT_AS`, because the JVM reserves a
> large virtual address space at startup and would be killed instantly. It is
> capped with `-Xmx` instead.

### Application security

- **Passwords** — bcrypt at cost 12, called directly rather than through
  passlib (passlib 1.7.4 reads `bcrypt.__about__.__version__`, which modern
  bcrypt removed; that pairing warns today and breaks on bcrypt 5). Inputs over
  72 bytes are rejected rather than silently truncated into collisions.
- **Tokens** — HS256 JWTs with an explicit `algorithms=[...]` on decode, which
  is what prevents `alg: none` and algorithm-confusion attacks. The subject is
  the immutable user id, not the email.
- **Login** — an unknown email is verified against a dummy hash so wrong-email
  and wrong-password take the same time and return an identical message.
- **Authorisation** — every write to problems, test cases and contests is behind
  `get_current_admin`. Submission source code is readable only by its author or
  an admin.
- **Discovery** — unpublished problems return **404**, not 403, so their
  existence is not leaked.
- **Secrets** — `SECRET_KEY` is mandatory in production and startup fails
  without it. Development generates an ephemeral per-process key.
- **Database errors** — logged in full, returned as a generic message, because
  driver errors routinely echo table and column names.
- **Race conditions** — uniqueness is enforced by database constraints
  (`uq_contest_problem`, `uq_contest_registration`, unique email/username), with
  `IntegrityError` translated to `409`. The application-level pre-checks are
  only a friendlier fast path.

---

## 🗄 Data model

```mermaid
erDiagram
    USERS ||--o{ SUBMISSIONS : submits
    USERS ||--o{ CONTEST_REGISTRATIONS : registers
    PROBLEMS ||--o{ TEST_CASES : has
    PROBLEMS ||--o{ SUBMISSIONS : receives
    PROBLEMS ||--o{ CONTEST_PROBLEMS : "appears in"
    CONTESTS ||--o{ CONTEST_PROBLEMS : includes
    CONTESTS ||--o{ CONTEST_REGISTRATIONS : accepts
    CONTESTS ||--o{ SUBMISSIONS : scopes

    USERS {
        int id PK
        string username UK
        string email UK
        string hashed_password
        bool is_admin
        bool is_active
    }
    PROBLEMS {
        int id PK
        string title UK
        string slug UK
        string difficulty
        int time_limit_ms
        int memory_limit_mb
        bool is_public
    }
    TEST_CASES {
        int id PK
        int problem_id FK
        text input_data
        text expected_output
        bool is_sample
        int order_index
    }
    SUBMISSIONS {
        int id PK
        int user_id FK
        int problem_id FK
        int contest_id FK "null for practice"
        string language
        string verdict
        float execution_time_ms
        int memory_kb
        int score
        int failed_test_index
    }
    CONTESTS {
        int id PK
        string slug UK
        datetime start_time
        datetime end_time
        int penalty_minutes_per_wrong
    }
    CONTEST_PROBLEMS {
        int id PK
        int contest_id FK
        int problem_id FK
        string label
        int points
    }
    CONTEST_REGISTRATIONS {
        int id PK
        int contest_id FK
        int user_id FK
        datetime registered_at
    }
```

**Indexes that matter.** `(user_id, created_at)` backs the history and dashboard
aggregates; `(contest_id, user_id)` backs leaderboard scans; `(problem_id,
user_id)` backs "best result per user per problem". Foreign keys cascade, so
deleting a problem removes its test cases, submissions and contest links in one
statement.

**Contest scoping.** `submissions.contest_id` is what separates contest results
from practice. A practice solve never moves a leaderboard.

---

## 🛠 Tech stack

| Layer | Choice | Why |
|---|---|---|
| API | FastAPI 0.116 | Type-driven validation and OpenAPI generated from the same annotations |
| Language | Python 3.11 | `X \| Y` unions, `StrEnum`, better tracebacks |
| ORM | SQLAlchemy 2.0 | Typed `Mapped[...]` declarative models, modern `select()` API |
| Database | PostgreSQL 16+ (Neon-hosted, currently 18) | Real constraints, partial aggregates; SQLite supported for zero-setup dev |
| Validation | Pydantic v2 + pydantic-settings | One schema layer for requests, responses and config |
| Auth | python-jose (JWT) + bcrypt | Standard bearer tokens; bcrypt called directly |
| Sandbox | Docker SDK 7.1, POSIX rlimits | Container isolation, with a documented fallback |
| Tests | pytest + httpx TestClient | Full-stack tests over real HTTP, no service dependencies |
| CI/CD | GitHub Actions | Test suite, seed verification and an image build on every push |
| Hosting | Render (app) + Neon (database) | Both have genuinely free tiers |

---

## 📂 Project structure

```
online-coding-judge/
├── app/
│   ├── config.py                 # Settings, validated at import; fails fast
│   ├── database.py               # Engine + session factory (Postgres/SQLite)
│   ├── main.py                   # App factory, middleware, error handlers, lifespan
│   │
│   ├── dependencies/
│   │   ├── auth.py               # get_current_user / get_current_admin / optional
│   │   └── database.py           # Request-scoped session with rollback
│   │
│   ├── execution/                # ── the judge engine ──
│   │   ├── base.py               # SandboxBackend interface, Outcome, results
│   │   ├── languages.py          # Per-language compile/run recipes
│   │   ├── docker_backend.py     # Container-per-run sandbox
│   │   ├── local_backend.py      # rlimit subprocess fallback
│   │   ├── engine.py             # Backend selection (auto/docker/local)
│   │   └── judge.py              # Pipeline: order → run → compare → verdict
│   │
│   ├── models/                   # SQLAlchemy 2.0 typed models
│   │   ├── base.py               # DeclarativeBase + TimestampMixin
│   │   ├── enums.py              # Difficulty, Language, Verdict, ContestState
│   │   ├── user.py  problem.py  test_case.py  submission.py
│   │   └── contest.py  contest_problem.py  contest_registration.py
│   │
│   ├── routes/                   # ── 7 resource domains + system ──
│   │   ├── auth.py  problems.py  test_cases.py  submissions.py
│   │   ├── contests.py  contest_problems.py  dashboard.py
│   │   └── health.py
│   │
│   ├── schemas/                  # Pydantic request/response models
│   ├── services/
│   │   ├── leaderboard.py        # Contest scoring, penalties, ranking
│   │   └── stats.py              # Dashboard aggregates
│   └── utils/
│       ├── jwt.py  security.py  slug.py
│
├── scripts/
│   ├── seed.py                   # 6 problems, 1 contest, admin + demo users
│   └── verify_seed.py            # Judges a reference solution per problem
│
├── tests/                        # 66 tests
│   ├── conftest.py               # SQLite + local backend fixtures
│   ├── test_auth.py  test_problems.py  test_test_cases.py
│   ├── test_judging.py  test_contests.py  test_dashboard.py
│   └── test_health.py
│
├── docs/screenshots/             # README images + CAPTURE.md
├── .github/workflows/ci.yml
├── Dockerfile                    # Multi-stage; ships Python + GCC + JDK
├── docker-compose.yml            # Postgres + API with the real Docker sandbox
├── render.yaml                   # Render blueprint
├── .env.example
└── requirements.txt
```

---

## 🚀 Quick start

### Option A — SQLite, no database server (fastest)

```bash
git clone https://github.com/dhanoliya-ji/online-coding-judge.git
cd online-coding-judge

python -m venv venv
venv\Scripts\activate            # Windows
# source venv/bin/activate       # macOS / Linux

pip install -r requirements.txt

copy .env.example .env           # Windows
# cp .env.example .env           # macOS / Linux

python -m scripts.seed --reset   # 6 problems, 1 contest, 2 accounts
uvicorn app.main:app --reload
```

Open **<http://localhost:8000/docs>**. The defaults in `.env.example` use
SQLite, so nothing else is required.

Sign in with `admin@example.com` / `AdminPass123`, copy the `access_token`,
click **Authorize**, and submit a solution to problem 1:

```python
a, b = map(int, input().split())
print(a + b)
```

### Option B — Docker Compose, with the real container sandbox

```bash
docker compose up --build
docker compose exec api python -m scripts.seed --reset
```

Postgres and the API both start; the API is given the host Docker socket, so
submissions execute in **real, isolated containers**. Verify with:

```bash
curl http://localhost:8000/api/v1/health
# -> "execution": { "active": "docker", "isolation": { ... } }
```

Pre-pull the language images once to avoid a slow first submission:

```bash
docker pull python:3.11-slim && docker pull gcc:13 && docker pull eclipse-temurin:21-jdk
```

> ⚠️ Compose mounts `/var/run/docker.sock` into the API container. That is
> **root-equivalent access to your host** and is intended for local development
> only. See [Known limitations](#-known-limitations).

### Option C — Local Postgres

```bash
createdb online_judge
# .env:
# DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/online_judge
python -m scripts.seed --reset
uvicorn app.main:app --reload
```

---

## 🐘 Free hosted database (Neon)

**[Neon](https://neon.tech)** gives you a free serverless Postgres project with
no credit card. It is the recommended database for the live demo.

### Step 1 — Create the account

1. Go to **<https://neon.tech>** and click **Sign up**.
2. Sign in with **GitHub** (fastest) or an email address.
3. The free plan is selected automatically — no card is requested.

### Step 2 — Create the project

1. On first login Neon prompts **Create your first project**.
2. **Project name**: `online-coding-judge`
3. **Postgres version**: whatever Neon offers by default (18 at the time of
   writing). Nothing in this project is version-specific above 14.
4. **Region**: pick the one nearest your Render region — `AWS US West (Oregon)`
   pairs with Render's `oregon`. Latency between app and database matters far
   more than either one's absolute location.
5. Click **Create project**.

### Step 3 — Copy the connection string

This is the part people get stuck on:

1. In the Neon console open your project and find the **Connection Details**
   panel on the **Dashboard** (also under **Settings → Connection string**).
2. **Branch** `main`, **Database** `neondb`, **Role** `neondb_owner`.
3. Set the dropdown to **Pooled connection** ✅ — pooling matters because a free
   Render instance opens more connections than a direct endpoint allows.
4. Click the **eye icon** to reveal the password, then **Copy**.

You get something shaped like this:

```
postgresql://neondb_owner:npg_XXXXXXXXXXXX@ep-cool-name-a1b2c3d4-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require
```

| Part | Meaning |
|---|---|
| `neondb_owner` | Role (username) |
| `npg_XXXX…` | **Password** — revealed by the eye icon |
| `ep-cool-name-a1b2c3d4-pooler…` | Host. **`-pooler`** means the pooled endpoint |
| `neondb` | Database name |
| `?sslmode=require` | **Keep this.** Neon refuses unencrypted connections |

### Step 4 — Use it

Paste it into `.env` (or into Render's dashboard) exactly as copied:

```env
DATABASE_URL=postgresql://neondb_owner:npg_XXXX@ep-xxx-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require
```

You do **not** need to rewrite the scheme. `app/config.py` normalises
`postgres://` and `postgresql://` to `postgresql+psycopg2://` automatically.

Then create the schema and seed it:

```bash
python -m scripts.seed --reset
```

Confirm from the Neon console: **Tables** should list `users`, `problems`,
`test_cases`, `submissions`, `contests`, `contest_problems`,
`contest_registrations`.

<details>
<summary><b>Alternatives if you prefer another provider</b></summary>

| Provider | Free tier | Notes |
|---|---|---|
| **[Neon](https://neon.tech)** | 0.5 GB, no card | Recommended. Scales to zero when idle |
| [Supabase](https://supabase.com) | 500 MB, no card | Postgres plus auth/storage you will not need here. Pauses after 7 idle days |
| [Aiven](https://aiven.io) | 1 month trial | Then paid |
| [Railway](https://railway.app) | $5 trial credit | Simple, but not permanently free |

Any of them works — the connection string goes in the same place.
</details>

---

## ☁️ Deployment

### Deploy to Render (free)

**Prerequisites:** the repo pushed to GitHub, and a Neon `DATABASE_URL` from above.

#### Step 1 — Push

```bash
git add -A
git commit -m "Production-ready judge"
git push origin main
```

#### Step 2 — Create the service

1. Sign up at **<https://render.com>** (GitHub login is easiest — no card for the free plan).
2. **New +** → **Blueprint**.
3. Connect your GitHub account and pick `online-coding-judge`.
4. Render detects [`render.yaml`](render.yaml) and proposes a free web service.

> The blueprint uses Render's **native Python runtime**, not Docker. Render's
> free tier exposes no Docker socket, so building an image bought no isolation
> — only a slow, brittle build. `pip install` is faster and far simpler. The
> Docker sandbox remains the real one; run `docker compose up` locally for it.

#### Step 3 — Set the two secret variables

`render.yaml` deliberately leaves these blank (`sync: false`) so no credential
is ever committed:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your full Neon pooled connection string |
| `ADMIN_EMAILS` | The email you will register with, e.g. `you@gmail.com` |

`SECRET_KEY` is generated by Render automatically and stays stable across
deploys. Everything else is preset in the blueprint.

#### Step 4 — Deploy

Click **Apply**. The build takes 2–3 minutes. When it goes live:

```bash
curl https://<your-service>.onrender.com/api/v1/ping
# {"status":"ok"}
```

Tables are created automatically on first boot.

#### Step 5 — Seed the live database

From your machine, pointing at the same Neon database:

```bash
# .env must contain the Neon DATABASE_URL
python -m scripts.seed --reset
python scripts/verify_seed.py    # confirms every problem accepts a correct solution
```

Then open `https://<your-service>.onrender.com/docs`, register with the email
you put in `ADMIN_EMAILS`, and you have admin rights.

#### Step 6 — Put the URL in this README

Replace `<your-service>` in [Live demo](#-live-demo) with your real Render
subdomain, and update the badge URLs at the top with your GitHub username.

<details>
<summary><b>Render free-tier behaviour worth knowing</b></summary>

- **Spin-down**: idle for ~15 minutes → the instance stops. The next request
  takes 40–60 s. Free cron pingers exist, but Render's terms discourage
  keep-alive pinging; the honest fix is to mention the cold start in your demo.
- **750 instance-hours/month** — plenty for one service.
- **No Docker socket**, hence `EXECUTION_BACKEND=local` in the blueprint.
- **Ephemeral filesystem** — never use SQLite here; it is wiped on redeploy.
- **Language toolchains**: Python is guaranteed. C++ works if the native image
  ships `g++`. **Java does not** — no JDK on the native Python runtime, so a
  Java submission returns a clear "toolchain is not installed" error rather
  than a misleading verdict. `GET /api/v1/health` lists exactly which
  toolchains the running instance can use. All three work locally under
  `docker compose up`.
- **Changing `runtime` in `render.yaml` does not apply to an existing service.**
  Render pins the runtime at creation, so switching from `docker` to `python`
  means deleting the service and re-applying the blueprint.
</details>

<details>
<summary><b>Deploying somewhere with a real Docker sandbox</b></summary>

To run the container backend in production you need a host where you control
the daemon — a VPS (Hetzner, DigitalOcean, Fly.io with a Machine), not a shared
PaaS. There:

```env
EXECUTION_BACKEND=docker
EXECUTION_WORKDIR=/tmp/judge
```

and give the API access to the socket, as `docker-compose.yml` shows. The
production-grade shape is a **separate worker host** that only judges, reachable
by the API over a private network, so a sandbox escape never lands on the box
holding your database credentials.
</details>

---

## ⚙️ Configuration reference

Every value is read from the environment or `.env` and validated at import.

### Core

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./online_judge.db` | Connection string. `postgres://` and `postgresql://` are auto-normalised to `postgresql+psycopg2://` |
| `SECRET_KEY` | *(generated in dev)* | JWT signing key. **Mandatory in production** — startup fails without it |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token lifetime |
| `ADMIN_EMAILS` | *(empty)* | Comma-separated emails auto-promoted to admin on registration |
| `ENVIRONMENT` | `development` | `development` / `staging` / `production` |
| `CORS_ORIGINS` | `*` | Comma-separated origins, or `*` |

### Execution engine

| Variable | Default | Description |
|---|---|---|
| `EXECUTION_BACKEND` | `auto` | `auto` (Docker if reachable, else local), `docker`, or `local` |
| `EXECUTION_TIME_LIMIT_MS` | `2000` | Default wall clock; a problem may override it |
| `EXECUTION_MEMORY_LIMIT_MB` | `128` | Default memory cap |
| `EXECUTION_CPU_QUOTA_PERCENT` | `50` | Share of one core (Docker backend) |
| `EXECUTION_PIDS_LIMIT` | `64` | Max processes — the fork-bomb guard |
| `EXECUTION_MAX_OUTPUT_BYTES` | `65536` | Beyond this → Output Limit Exceeded |
| `EXECUTION_COMPILE_TIMEOUT_S` | `15` | Compilation timeout |
| `EXECUTION_WORKDIR` | *(system temp)* | Sandbox staging dir. Set **only** when the API is containerised and shares the host's Docker socket — see the note in `.env.example` |

### Database tuning

| Variable | Default | Description |
|---|---|---|
| `DB_POOL_SIZE` | `5` | Pool size (Postgres only) |
| `DB_MAX_OVERFLOW` | `10` | Overflow connections |
| `DB_ECHO` | `false` | Log every SQL statement. Leave off in production |

---

## 📖 API reference

Base path: **`/api/v1`** · Interactive docs: **`/docs`** · Schema: **`/openapi.json`**

Auth column: 🌐 public · 🔑 any signed-in user · 👑 admin only

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | 🌐 | Create an account, receive a token |
| `POST` | `/auth/login` | 🌐 | Exchange email + password for a token |
| `GET` | `/auth/me` | 🔑 | Current account |

### Problems

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/problems` | 🌐 | List — `search`, `difficulty`, `solved`, `limit`, `offset` |
| `GET` | `/problems/{id\|slug}` | 🌐 | One problem, by numeric id or slug |
| `POST` | `/problems` | 👑 | Create |
| `PATCH` | `/problems/{id}` | 👑 | Partial update |
| `DELETE` | `/problems/{id}` | 👑 | Delete (cascades) |

### Test cases

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/testcases/problem/{id}` | 🌐 | Samples in full; **hidden cases redacted** |
| `GET` | `/testcases/problem/{id}/admin` | 👑 | Full suite including hidden data |
| `POST` | `/testcases/problem/{id}` | 👑 | Add one |
| `POST` | `/testcases/problem/{id}/bulk` | 👑 | Upload a suite, optionally replacing |
| `PATCH` | `/testcases/{id}` | 👑 | Update |
| `DELETE` | `/testcases/{id}` | 👑 | Delete |

### Submissions

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/submissions/languages` | 🌐 | Supported languages |
| `POST` | `/submissions` | 🔑 | **Submit and judge**, returns the verdict |
| `POST` | `/submissions/run` | 🔑 | Run against custom input, nothing stored |
| `GET` | `/submissions` | 🔑 | Your history — filter by problem, contest, verdict, language |
| `GET` | `/submissions/problem/{id}` | 🔑 | Fastest accepted solutions (no source) |
| `GET` | `/submissions/{id}` | 🔑 | One submission with source — **author or admin only** |

### Contests

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/contests` | 🌐 | List, filterable by state |
| `GET` | `/contests/{id\|slug}` | 🌐 | One contest |
| `POST` | `/contests` | 👑 | Create |
| `PATCH` | `/contests/{id}` | 👑 | Update |
| `DELETE` | `/contests/{id}` | 👑 | Delete |
| `POST` | `/contests/{id}/join` | 🔑 | Register |
| `DELETE` | `/contests/{id}/join` | 🔑 | Withdraw |
| `GET` | `/contests/{id}/participants` | 🌐 | Registered users |
| `GET` | `/contests/{id}/leaderboard` | 🌐 | Standings with penalties |

### Contest problems

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/contests/{id}/problems` | 🌐 | Problems — **withheld until the contest starts** |
| `POST` | `/contests/{id}/problems` | 👑 | Add a problem |
| `PATCH` | `/contests/{id}/problems/{pid}` | 👑 | Change label, points or order |
| `DELETE` | `/contests/{id}/problems/{pid}` | 👑 | Remove |

### Dashboard & system

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/dashboard` | 🔑 | Your analytics |
| `GET` | `/health` | 🌐 | DB + sandbox status |
| `GET` | `/ping` | 🌐 | Liveness probe |

### Worked example

```bash
BASE=http://localhost:8000/api/v1

TOKEN=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"ada","email":"ada@example.com","password":"adaPass1234"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X POST $BASE/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"problem_id":1,"language":"python","source_code":"a,b=map(int,input().split())\nprint(a+b)"}'
```

```jsonc
{
  "id": 1,
  "verdict": "Accepted",
  "score": 100,
  "passed_tests": 6,
  "total_tests": 6,
  "execution_time_ms": 63.1,
  "memory_kb": 9216,
  "execution_time_display": "63.10 ms",
  "memory_display": "9.00 MB",
  "failed_test_index": null,
  "backend": "docker",
  "test_results": [
    { "index": 1, "is_sample": true,  "passed": true, "verdict": "Accepted",
      "input_data": "2 3", "expected_output": "5", "actual_output": "5" },
    { "index": 3, "is_sample": false, "passed": true, "verdict": "Accepted",
      "input_data": null, "expected_output": null, "actual_output": null }
    // hidden cases report an index and metrics only
  ]
}
```

---

## ⚖️ Verdict reference

| Verdict | Meaning | Trigger |
|---|---|---|
| **Accepted** | Every test passed | All outputs matched after normalisation |
| **Wrong Answer** | Output differs | Normalised comparison failed |
| **Time Limit Exceeded** | Too slow | Wall clock exceeded the problem's limit |
| **Memory Limit Exceeded** | Too much memory | Container OOM kill, or `RLIMIT_AS` hit |
| **Runtime Error** | Crashed | Non-zero exit: exception, segfault, bad exit code |
| **Compilation Error** | Would not build | `g++`/`javac` failed, or Python failed `py_compile` |
| **Output Limit Exceeded** | Printed too much | Beyond `EXECUTION_MAX_OUTPUT_BYTES` |
| **Internal Error** | The judge failed | Sandbox unavailable, or a problem with no test cases |

---

## 🧪 Testing

```bash
pytest                       # 66 tests
pytest -v                    # verbose
pytest tests/test_judging.py # one module
pytest -k leaderboard        # by name
```

The suite runs on SQLite with the local backend — no Postgres, no Docker.
Each test gets a freshly created and dropped schema.

| Module | Tests | Covers |
|---|---|---|
| `test_auth.py` | 7 | Registration, duplicates, weak passwords, case-insensitive email, enumeration resistance |
| `test_problems.py` | 7 | RBAC, pagination, filters, slug lookup, draft visibility, PATCH semantics |
| `test_test_cases.py` | 8 | **Hidden data redaction**, admin access, bulk upload, cascade delete |
| `test_judging.py` | 18 | All five reachable verdicts, scoring, redaction, source privacy, output normalisation |
| `test_contests.py` | 15 | Window validation, state derivation, registration, **leaderboard scoring rules** |
| `test_dashboard.py` | 5 | Aggregates, division-by-zero, per-caller scoping |
| `test_health.py` | 5 | Health payload, OpenAPI generation, timing header |

Seed data has its own guard — `scripts/verify_seed.py` judges a known-correct
solution against every bundled problem, so a wrong expected output is caught in
CI rather than by a confused user.

---

## 🧭 Design decisions

<details>
<summary><b>Why judge synchronously instead of using a Celery queue?</b></summary>

Judging is bounded: `test_count × time_limit`, and evaluation stops at the first
failure. For the problem sizes here that is well under a second in the common
case. A synchronous response means the client gets a verdict without polling,
which is a materially better API.

The submission row is written **before** judging starts, so the design is
already queue-shaped: moving execution to a worker means changing who calls
`judge_submission` and adding a status poll, not restructuring the data model.
That is the natural next step at real traffic — see [Roadmap](#-roadmap).
</details>

<details>
<summary><b>Why <code>create_all()</code> rather than Alembic migrations?</b></summary>

`create_all()` is idempotent and runs on startup, so a fresh Neon database
works with zero manual steps — which is exactly what a deployable portfolio
project needs. The trade-off is honest: it creates missing tables but never
alters existing ones, so a production system that must preserve data through a
schema change needs Alembic. Adding it later is mechanical; shipping a
hand-written migration that silently drifts from the models would be worse than
not having one.
</details>

<details>
<summary><b>Why stop at the first failing test?</b></summary>

It is standard judge behaviour and it bounds cost: a submission can never
consume more than `test_count × time_limit`, and a wrong solution usually costs
one execution because samples run first. The trade-off is that partial scores
are coarse. Running every test would give a finer score but let a deliberately
slow wrong submission consume the full budget every time.
</details>

<details>
<summary><b>Why is the leaderboard computed on read rather than cached?</b></summary>

It is two indexed queries plus an in-memory fold, which is comfortably fast at
contest scale. A denormalised standings table would be faster but must be kept
correct against late rejudges and contest-time edits. At the point where read
latency matters, the fix is a cache with explicit invalidation on new
submissions — not scattering write-time updates through the submission path.
</details>

<details>
<summary><b>Why compare output with normalisation?</b></summary>

Exact byte comparison fails correct solutions over a trailing newline, which is
the single most common false negative in home-grown judges. Normalising CRLF,
per-line trailing whitespace and trailing blank lines matches what Codeforces
and ICPC do. Internal blank lines and leading whitespace stay significant,
because those genuinely change an answer's shape.
</details>

<details>
<summary><b>What was wrong with the original implementation</b></summary>

This started as a working prototype. The rebuild fixed, among others:

| Issue | Impact |
|---|---|
| `routes/contest_problem.py` used `router`, `Depends`, `HTTPException`, `Session`, `get_db` and `Contest` without importing or defining any of them | The module could not be imported; both contest-problem endpoints were dead, and it was never registered on the app |
| `GET /testcases/problem/{id}` returned **hidden** test cases unauthenticated | The answer key for every problem was public |
| No auth on problem, test-case or contest writes | Anonymous callers could create and delete content |
| Leaderboard counted *all* accepted submissions platform-wide | Resubmitting an accepted solution farmed 100 points per submission; practice solves moved contest standings |
| `language` accepted but ignored; the C++/Java runners were never imported | Every submission ran through `python`, so C++ and Java always failed |
| Docker-in-Docker never wired; `docker.from_env()` returned `None` in-container | Every submission judged as Runtime Error via the `exit_code: -1` path |
| Bind mount used a container-side path | `/code` mounted empty even where the daemon was reachable |
| `container.logs()` merged stdout and stderr; stderr hard-coded to `""` | A program that logged to stderr got a spurious Wrong Answer |
| `memory_used` hard-coded to `"128 MB"` | The reported metric was the limit, not a measurement |
| Contest `start_time`/`end_time` never enforced | Submissions accepted before and after the window |
| `requirements.txt` saved as UTF-16 | `pip install -r` failed, breaking the Docker build |
| No unique constraints on `(contest_id, problem_id)` / `(contest_id, user_id)` | Duplicate rows under concurrency |
| `test_judge.py` called a signature that did not exist, with module-level side effects | `pytest` failed at collection |
</details>

---

## ⚠️ Known limitations

Stated plainly, because a judge that overstates its isolation is worse than one
that documents its edges.

1. **The free live demo does not use container isolation.** Free PaaS tiers do
   not expose a Docker socket, so the deployment runs the `local` rlimit
   backend, which has no network or filesystem namespace. Treat the hosted demo
   as a functional showcase, not a hardened service. `/api/v1/health` always
   reports the truth.
2. **Compose mounts the Docker socket.** That grants root-equivalent host
   access to the API container. It is fine locally; production should judge on
   a separate worker host.
3. **Judging is synchronous.** A burst of submissions occupies worker threads.
   Correct under demo load; a queue is the fix at scale.
4. **`create_all()` is not a migration system.** New tables appear; changed
   columns do not.
5. **No rate limiting.** A determined caller can spam the judge. A reverse proxy
   limit or `slowapi` is the straightforward addition.
6. **The Docker backend is unverified on Windows hosts.** It is written against
   Linux container semantics (cgroups, `nobody`, tmpfs). Docker Desktop runs a
   Linux VM so it should work, but the CI matrix only exercises the local
   backend. Verify with `docker compose up` before relying on it.
7. **Peak memory on the local backend is approximate.** It is derived from
   `getrusage(RUSAGE_CHILDREN).ru_maxrss`, which is only precise for serialised
   runs. The Docker backend samples real container stats.
8. **No email verification or password reset.**

---

## 🗺 Roadmap

- [ ] **Celery + Redis queue** — asynchronous judging with a status poll; the
      submission row already models this
- [ ] **WebSocket live verdicts** — per-test progress as it happens
- [ ] **Rate limiting** — per-user submission throttle
- [ ] **Alembic migrations** — once the schema needs to change under real data
- [ ] **Dedicated judge workers** — isolate execution from the credential-holding host
- [ ] **More languages** — Go, Rust, JavaScript (one `LanguageSpec` each)
- [ ] **Special judges** — checker programs for problems with multiple valid answers
- [ ] **Rejudge** — re-run a problem's submissions after a test-suite fix
- [ ] **Editorials and problem tags**
- [ ] **React frontend** with a Monaco editor
- [ ] **Plagiarism detection** — MOSS-style similarity over accepted solutions

---

## 👨‍💻 Author

**Gajendra Dhanoliya**

- GitHub — [@dhanoliya-ji](https://github.com/dhanoliya-ji)
- LinkedIn — [Gajendra Dhanoliya](https://www.linkedin.com/in/gajendradhanoliya-dhanoliya-813345359/)

---

## 📄 License

Released under the [MIT License](LICENSE).

---

<div align="center">

**If this project is useful to you, a ⭐ on GitHub is appreciated.**

</div>
