"""The migrations build exactly the schema the models describe.

On SQLite each test gets its own throw-away file. When the suite runs
against Postgres (the CI "Postgres" job, and what production uses), each
test wipes and reuses the test database instead, so the Postgres-only parts
-- the advisory lock and the full-text index -- are exercised for real.
"""

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from app.config import settings
from app.migrate import BASELINE, MIGRATIONS, schema_differences, upgrade_database
from app.models import Base

POSTGRES = settings.DATABASE_URL.startswith("postgresql")

_config = Config()
_config.set_main_option("script_location", str(MIGRATIONS))
HEAD = ScriptDirectory.from_config(_config).get_current_head()


@pytest.fixture
def blank(tmp_path):
    """An engine on an empty database."""
    if not POSTGRES:
        return create_engine(f"sqlite:///{(tmp_path / 'migrations.db').as_posix()}")

    from app.database import engine

    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    return engine


def _version(engine):
    with engine.connect() as connection:
        return connection.execute(text("SELECT version_num FROM alembic_version")).scalar()


def test_migrations_match_the_models(blank):
    upgrade_database(blank)
    with blank.connect() as connection:
        diff = schema_differences(connection)
    assert diff == [], f"models and migrations disagree; add a migration: {diff}"


def test_a_pre_migration_database_is_stamped_then_upgraded(blank):
    """The live database was made by create_all, before migrations existed."""
    # What the old create_all start-up produced: the baseline tables with
    # data in them, and no migration history at all.
    upgrade_database(blank, revision=BASELINE)
    with blank.begin() as connection:
        connection.execute(text("DROP TABLE alembic_version"))
        connection.execute(text(
            "INSERT INTO problems (title, slug, description, difficulty, input_format,"
            " output_format, constraints, sample_input, sample_output)"
            " VALUES ('Kept', 'kept', 'd', 'Easy', '-', '-', '-', '1', '1')"
        ))

    upgrade_database(blank)

    inspector = inspect(blank)
    assert {"tags", "problem_tags"} <= set(inspector.get_table_names())
    assert "source" in {c["name"] for c in inspector.get_columns("problems")}
    with blank.connect() as connection:
        assert connection.execute(text("SELECT title FROM problems")).scalar() == "Kept"
    assert _version(blank) == HEAD


def test_a_current_create_all_database_is_stamped_at_head(blank):
    """e.g. made by an older `seed --reset`: nothing to apply, nothing to fail."""
    Base.metadata.create_all(blank)
    upgrade_database(blank)
    assert _version(blank) == HEAD


def test_upgrading_twice_is_harmless(blank):
    upgrade_database(blank)
    upgrade_database(blank)


@pytest.mark.skipif(not POSTGRES, reason="full-text search is Postgres-only")
@pytest.mark.parametrize("start", ["empty", "create_all"])
def test_full_text_index_exists(blank, start):
    if start == "create_all":
        Base.metadata.create_all(blank)  # stamped at head: skips migration 0002
    upgrade_database(blank)
    with blank.connect() as connection:
        found = connection.execute(
            text("SELECT 1 FROM pg_indexes WHERE indexname = 'ix_problems_fulltext'")
        ).scalar()
    assert found == 1


def test_year_long_demo_contest_is_ended_by_0004(blank):
    """The old seed's year-long practice round must stop locking its problems."""
    from datetime import datetime, timedelta, timezone

    upgrade_database(blank, revision="0003")
    now = datetime.now(timezone.utc)
    with blank.begin() as connection:
        connection.execute(
            text("INSERT INTO contests (title, slug, description, start_time, end_time) VALUES"
                 " ('Practice Round #1', 'pr1', 'd', :s1, :e1), ('Weekly', 'w', 'd', :s2, :e2)"),
            {"s1": now - timedelta(days=60), "e1": now + timedelta(days=300),
             "s2": now - timedelta(minutes=30), "e2": now + timedelta(minutes=60)},
        )
    upgrade_database(blank)
    with blank.connect() as connection:
        rows = dict(connection.execute(text("SELECT slug, end_time FROM contests")).all())
        rated = dict(connection.execute(text("SELECT slug, rated FROM contests")).all())

    def aware(value):
        value = datetime.fromisoformat(value) if isinstance(value, str) else value
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    assert aware(rows["pr1"]) <= datetime.now(timezone.utc)
    assert not rated["pr1"]
    assert aware(rows["w"]) > datetime.now(timezone.utc)  # normal contests untouched


@pytest.mark.skipif(POSTGRES, reason="Postgres uses an advisory lock; this covers SQLite's lock file")
def test_concurrent_workers_migrate_one_at_a_time(tmp_path):
    """The image runs two uvicorn workers; both migrate a fresh database on boot."""
    import subprocess
    import sys

    database = (tmp_path / "race.db").as_posix()
    script = (
        "from sqlalchemy import create_engine\n"
        "from app.migrate import upgrade_database\n"
        f"upgrade_database(create_engine('sqlite:///{database}'))\n"
    )
    workers = [subprocess.Popen([sys.executable, "-c", script], stderr=subprocess.PIPE, text=True)
               for _ in range(3)]
    for worker in workers:
        _, err = worker.communicate(timeout=120)
        assert worker.returncode == 0, err[-2000:]
    assert _version(create_engine(f"sqlite:///{database}")) == HEAD
