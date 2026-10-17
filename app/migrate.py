"""Bring the database schema up to date. Runs on every start-up.

    python -m app.migrate      # the same thing, by hand

Databases created by ``create_all`` have tables but no ``alembic_version``.
One that already matches the models is stamped at the head; any other (the
live database predates migrations) is stamped at the baseline and upgraded
like any other, so existing data is never recreated.

The API's workers each run this on boot, so the whole step is serialised:
an advisory lock on Postgres, a lock file next to the database on SQLite.
Whoever goes second finds everything applied and does nothing.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.database import engine as default_engine
from app.models import Base

logger = logging.getLogger(__name__)

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
BASELINE = "0001"
_LOCK_KEY = 0x4A55_4447  # any constant; "JUDG"

#: Indexes created by migrations but not declared on the models, because
#: they only exist on Postgres. Comparisons with the models must skip them.
POSTGRES_ONLY_INDEXES = {"ix_problems_fulltext"}

SEARCH_INDEX_DDL = (
    "CREATE INDEX IF NOT EXISTS ix_problems_fulltext ON problems "
    "USING gin (to_tsvector('english', title || ' ' || description))"
)


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    """Alembic filter: leave the Postgres-only indexes out of comparisons."""
    return not (type_ == "index" and name in POSTGRES_ONLY_INDEXES)


def schema_differences(connection) -> list:
    context = MigrationContext.configure(connection, opts={"include_object": include_object})
    return compare_metadata(context, Base.metadata)


@contextmanager
def _sqlite_file_lock(engine: Engine) -> Iterator[None]:
    """Hold an exclusive OS lock beside a SQLite database file (no-op otherwise)."""
    database = engine.url.database
    if engine.dialect.name != "sqlite" or not database or database == ":memory:":
        yield
        return
    lock_path = Path(database).resolve().with_name(Path(database).name + ".migrate.lock")
    with open(lock_path, "a+b") as handle:
        if os.name == "nt":
            import msvcrt

            while True:
                try:
                    handle.seek(0)
                    msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
                    break
                except OSError:
                    continue  # LK_LOCK gives up after ~10 s; keep waiting
            try:
                yield
            finally:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)


def upgrade_database(engine: Engine | None = None, revision: str = "head") -> None:
    engine = engine or default_engine
    with _sqlite_file_lock(engine):
        _upgrade(engine, revision)


def _upgrade(engine: Engine, revision: str) -> None:
    postgres = engine.dialect.name == "postgresql"

    with engine.connect() as connection:
        if postgres:
            connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": _LOCK_KEY})
            connection.commit()
        try:
            config = Config()
            config.set_main_option("script_location", str(MIGRATIONS))
            config.attributes["connection"] = connection

            tables = set(inspect(connection).get_table_names())
            if "alembic_version" not in tables and "problems" in tables:
                stamp_at = BASELINE if schema_differences(connection) else "head"
                logger.info("Database without migration history: stamping %s", stamp_at)
                command.stamp(config, stamp_at)
                connection.commit()

            command.upgrade(config, revision)
            if postgres and revision == "head":
                # A database stamped at head skipped the migration that
                # creates this index, so make sure it exists either way.
                connection.execute(text(SEARCH_INDEX_DDL))
            connection.commit()
        finally:
            if postgres:
                connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": _LOCK_KEY})
                connection.commit()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    upgrade_database()
    print("Database is up to date.")
