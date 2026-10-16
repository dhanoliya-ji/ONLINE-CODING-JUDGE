"""Query building blocks for the problem catalogue: tags, search, stats."""

from __future__ import annotations

import hashlib
from datetime import date, datetime, time, timezone

from sqlalchemy import Select, case, func, literal_column, or_, select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.contest import Contest
from app.models.contest_problem import ContestProblem
from app.models.enums import Verdict
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.tag import Tag, problem_tags
from app.utils.slug import slugify

DIFFICULTY_RANK = case(
    (Problem.difficulty == "Easy", 1),
    (Problem.difficulty == "Medium", 2),
    (Problem.difficulty == "Hard", 3),
    else_=4,
)


# ---------------------------------------------------------------- tags ---
def resolve_tags(db: Session, names: list[str]) -> list[Tag]:
    """The ``Tag`` rows for ``names``, creating any that do not exist yet."""
    tags: dict[str, Tag] = {}
    for raw in names:
        name = " ".join(raw.split())[:60]
        slug = slugify(name, max_length=60)
        if not name or slug in tags:
            continue
        tag = db.scalar(select(Tag).where(Tag.slug == slug))
        if tag is None:
            tag = Tag(slug=slug, name=name)
            db.add(tag)
            db.flush()
        tags[slug] = tag
    return list(tags.values())


def has_all_tags(slugs: list[str]):
    """A condition: the problem carries every one of ``slugs``."""
    return [
        Problem.id.in_(
            select(problem_tags.c.problem_id)
            .join(Tag, Tag.id == problem_tags.c.tag_id)
            .where(Tag.slug == slug)
        )
        for slug in slugs
    ]


# -------------------------------------------------------------- search ---
def _document():
    # Must match the expression indexed by migration 0002 exactly, literals
    # included, or Postgres will not use the GIN index.
    return func.to_tsvector(
        literal_column("'english'"),
        Problem.title + literal_column("' '") + Problem.description,
    )


def search_condition(text: str, dialect: str):
    """Title-or-statement match: full-text on Postgres, LIKE elsewhere."""
    text = text.strip()
    title_match = Problem.title.ilike(f"%{text}%")
    if dialect == "postgresql":
        query = func.websearch_to_tsquery(literal_column("'english'"), text)
        return or_(title_match, _document().op("@@")(query))
    return or_(title_match, Problem.description.ilike(f"%{text}%"))


def search_rank(text: str):
    """Relevance for ordering search results (Postgres only)."""
    query = func.websearch_to_tsquery(literal_column("'english'"), text.strip())
    title_bonus = case((Problem.title.ilike(f"%{text.strip()}%"), 1.0), else_=0.0)
    return title_bonus + func.ts_rank(_document(), query)


# --------------------------------------------------------------- stats ---
def submission_stats_subquery():
    """Per-problem totals: ``problem_id``, ``total``, ``accepted``."""
    return (
        select(
            Submission.problem_id.label("problem_id"),
            func.count(Submission.id).label("total"),
            func.sum(case((Submission.verdict == Verdict.ACCEPTED.value, 1), else_=0)).label(
                "accepted"
            ),
        )
        .group_by(Submission.problem_id)
        .subquery()
    )


def solved_by(user_id: int):
    return select(Submission.problem_id).where(
        Submission.user_id == user_id, Submission.verdict == Verdict.ACCEPTED.value
    )


def attempted_by(user_id: int):
    return select(Submission.problem_id).where(Submission.user_id == user_id)


# ------------------------------------------------------ contest guard ---
def locked_problem_ids():
    """Problems in a contest that is running or yet to start.

    They are excluded from the daily pick and random picks, so neither ever
    points practice traffic at a live contest's problems.
    """
    return (
        select(ContestProblem.problem_id)
        .join(Contest, Contest.id == ContestProblem.contest_id)
        .where(Contest.end_time > utcnow())
    )


# ---------------------------------------------------------------- picks ---
def daily_problem(db: Session, base: Select, today: date) -> Problem | None:
    """The same problem for everyone, all day; a different one tomorrow.

    Only problems that existed before today are candidates, so importing
    new problems during the day does not change today's pick.
    """
    midnight = datetime.combine(today, time.min, tzinfo=timezone.utc)
    candidates = base.where(Problem.created_at < midnight).order_by(Problem.id)
    count = db.scalar(select(func.count()).select_from(candidates.subquery())) or 0
    if count == 0:
        candidates = base.order_by(Problem.id)
        count = db.scalar(select(func.count()).select_from(candidates.subquery())) or 0
        if count == 0:
            return None
    index = int(hashlib.sha256(today.isoformat().encode()).hexdigest(), 16) % count
    return db.scalar(candidates.offset(index).limit(1))
