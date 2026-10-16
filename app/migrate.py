"""Bring the database schema up to date. Runs on every start-up.

    python -m app.migrate      # the same thing, by hand

Databases created by ``create_all`` have tables but no ``alembic_version``.
One that already matches the models is stamped at the head; any other (the
live database predates migrations) is stamped at the baseline and upgraded
like any other, so existing data is never recreated.

On Postgres the whole step holds an advisory lock, so the API's workers --
each of which runs this on boot -- migrate one at a time instead of racing.
"""

from __future__ import annotations

import logging
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


def upgrade_database(engine: Engine | None = None) -> None:
    engine = engine or default_engine
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
                current = not compare_metadata(MigrationContext.configure(connection), Base.metadata)
                revision = "head" if current else BASELINE
                logger.info("Database without migration history: stamping %s", revision)
                command.stamp(config, revision)
                connection.commit()

            command.upgrade(config, "head")
            connection.commit()
        finally:
            if postgres:
                connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": _LOCK_KEY})
                connection.commit()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    upgrade_database()
    print("Database is up to date.")
