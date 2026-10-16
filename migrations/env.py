"""Alembic environment.

Runs against the app's own engine and model metadata, so the database URL is
configured in exactly one place (``DATABASE_URL``). ``app.migrate`` passes in
an open connection; the ``alembic`` CLI gets a fresh one.
"""

from __future__ import annotations

from alembic import context

from app.database import engine
from app.migrate import include_object
from app.models import Base

target_metadata = Base.metadata


def run_migrations_online() -> None:
    connection = context.config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    with engine.begin() as fresh:
        _run(fresh)


def _run(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # SQLite cannot ALTER most things in place; batch mode copies the
        # table instead, which keeps one set of migrations for both dialects.
        render_as_batch=connection.dialect.name == "sqlite",
        compare_type=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():  # pragma: no cover - not used
    raise SystemExit("Offline (SQL script) migrations are not supported")
run_migrations_online()
