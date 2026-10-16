"""Step 3 of 3: put verified problems into the database configured by DATABASE_URL.

    python -m scripts.library.load verified-*.jsonl.gz [--dry-run]

Idempotent: problems are matched on ``external_id``, so running it again
updates statements, limits, tags and tests in place instead of duplicating
anything. Submissions to an updated problem are kept. A title already used
by a different problem gets the source added, e.g. "Two Arrays (Codeforces
1288C)".
"""

from __future__ import annotations

import argparse
import gzip
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.migrate import upgrade_database  # noqa: E402
from app.models import Problem, TestCase  # noqa: E402
from app.services.catalogue import resolve_tags  # noqa: E402
from app.utils.slug import unique_slug  # noqa: E402
from scripts.library.taco import LICENSE  # noqa: E402

logger = logging.getLogger("load")

BATCH = 100


def _title(db: Session, wanted: str, external_id: str, problem_id: int | None) -> str:
    def taken(title: str) -> bool:
        query = select(Problem.id).where(func.lower(Problem.title) == title.lower())
        if problem_id is not None:
            query = query.where(Problem.id != problem_id)
        return db.scalar(query) is not None

    if not taken(wanted):
        return wanted
    kind, *rest = external_id.split("/")
    label = {"codeforces": "Codeforces", "codechef": "CodeChef", "atcoder": "AtCoder"}.get(kind, kind)
    with_source = f"{wanted} ({label} {''.join(rest)})"
    return with_source if not taken(with_source) else f"{wanted} ({external_id})"


def _slug_taken(db: Session, slug: str, problem_id: int | None) -> bool:
    query = select(Problem.id).where(Problem.slug == slug)
    if problem_id is not None:
        query = query.where(Problem.id != problem_id)
    return db.scalar(query) is not None


def upsert(db: Session, data: dict) -> str:
    problem = db.scalar(select(Problem).where(Problem.external_id == data["external_id"]))
    created = problem is None
    if created:
        problem = Problem(external_id=data["external_id"], is_public=True)
        db.add(problem)

    title = _title(db, data["title"], data["external_id"], problem.id)
    if created or problem.title != title:
        problem.title = title
        problem.slug = unique_slug(title, lambda s: _slug_taken(db, s, problem.id))

    samples = [t for t in data["tests"] if t["sample"]] or data["tests"][:1]
    problem.description = data["description"]
    problem.difficulty = data["difficulty"]
    problem.input_format = data["input_format"]
    problem.output_format = data["output_format"]
    problem.constraints = data["constraints"]
    problem.sample_input = samples[0]["input"]
    problem.sample_output = samples[0]["output"]
    problem.time_limit_ms = data["time_limit_ms"]
    problem.memory_limit_mb = data["memory_limit_mb"]
    problem.checker = data["checker"]
    problem.rating = data.get("rating")
    problem.source = data["source"]
    problem.source_url = data["source_url"]
    problem.license = LICENSE
    problem.reference_solution = data.get("reference_solution")
    problem.reference_language = data.get("reference_language")
    problem.tags = resolve_tags(db, data["tags"])
    db.flush()

    if not created:
        db.query(TestCase).filter(TestCase.problem_id == problem.id).delete()
    db.add_all(
        TestCase(problem_id=problem.id, input_data=t["input"], expected_output=t["output"],
                 is_sample=t["sample"], order_index=index)
        for index, t in enumerate(data["tests"])
    )
    return "created" if created else "updated"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="roll back instead of committing")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    upgrade_database()
    counts = {"created": 0, "updated": 0}
    with SessionLocal() as db:
        pending = 0
        for path in args.files:
            with gzip.open(path, "rt", encoding="utf-8") as handle:
                for line in handle:
                    counts[upsert(db, json.loads(line))] += 1
                    pending += 1
                    if pending >= BATCH:
                        db.rollback() if args.dry_run else db.commit()
                        pending = 0
                        logger.info("%s so far", counts)
        db.rollback() if args.dry_run else db.commit()
    logger.info("Done%s: %s", " (dry run, nothing saved)" if args.dry_run else "", counts)


if __name__ == "__main__":
    main()
