from tests.conftest import API


def test_health_reports_database_and_execution_backend(client):
    response = client.get(f"{API}/health")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["database"]["connected"] is True
    assert body["execution"]["active"] in {"docker", "local"}
    assert set(body["languages"]) == {"python", "cpp", "java"}


def test_ping_is_cheap_and_public(client):
    assert client.get(f"{API}/ping").json() == {"status": "ok"}


def test_root_advertises_the_docs(client):
    body = client.get("/").json()
    assert body["docs"] == "/docs"
    assert body["api_prefix"] == API


def test_openapi_schema_is_generated(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    for expected in (
        f"{API}/auth/login",
        f"{API}/problems",
        f"{API}/submissions",
        f"{API}/contests",
        f"{API}/dashboard",
    ):
        assert expected in paths


def test_timing_header_is_attached(client):
    response = client.get(f"{API}/ping")
    assert float(response.headers["X-Process-Time-Ms"]) >= 0


def test_a_database_failure_is_reported_without_its_detail(client):
    # /health is public. A driver error can carry the database host, user or
    # even a password from a malformed URL; none of that may reach the body.
    from app.dependencies.database import get_db
    from app.main import app

    class BrokenSession:
        bind = None

        def execute(self, *_args, **_kwargs):
            raise RuntimeError("could not connect to db.internal:5432 as admin:hunter2")

    app.dependency_overrides[get_db] = lambda: BrokenSession()
    try:
        response = client.get(f"{API}/health")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["database"] == {"connected": False, "error": "database unreachable"}
    assert "hunter2" not in response.text and "db.internal" not in response.text


def test_startup_survives_another_worker_creating_tables_first(monkeypatch):
    # Two uvicorn workers booting on a fresh database race to CREATE TABLE.
    # The loser used to crash with "table ... already exists".
    from sqlalchemy.exc import OperationalError

    import app.main as main

    calls = []

    def create_all(**_kwargs):
        calls.append(1)
        if len(calls) == 1:
            raise OperationalError("CREATE TABLE contest_problems", {}, Exception("table contest_problems already exists"))

    monkeypatch.setattr(main.Base.metadata, "create_all", create_all)
    main._create_tables()
    assert len(calls) == 2


def test_a_real_database_error_at_startup_still_surfaces(monkeypatch):
    from sqlalchemy.exc import OperationalError

    import app.main as main
    import pytest

    def create_all(**_kwargs):
        raise OperationalError("SELECT 1", {}, Exception("unable to open database file"))

    monkeypatch.setattr(main.Base.metadata, "create_all", create_all)
    with pytest.raises(OperationalError):
        main._create_tables()
