"""Create or upgrade every table on the configured database.

The application also does this on startup, so this script is only needed when
you want to prepare a database ahead of the first boot.

    python create_tables.py      # same as: python -m app.migrate
"""

from app.migrate import upgrade_database


def main() -> None:
    upgrade_database()
    print("Database is up to date.")


if __name__ == "__main__":
    main()
