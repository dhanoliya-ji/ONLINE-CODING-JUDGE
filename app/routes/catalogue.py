"""Catalogue extras: filter facets, a random pick and the daily problem.

Registered before the problems router, whose ``/problems/{identifier}``
route would otherwise capture ``/problems/random`` and ``/problems/daily``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies.auth import get_optional_user
from app.dependencies.database import get_db
from app.models.base import utcnow
from app.models.enums import Difficulty
from app.models.problem import Problem
from app.models.tag import Tag, problem_tags
from app.models.user import User
from app.routes.problems import _summaries
from app.schemas.problem import Facets, ProblemSummary, TagCount
from app.services import catalogue

router = APIRouter(prefix="/problems", tags=["Problems"])


def _practice_pool():
    """Public problems that are not tied up in a live or upcoming contest."""
    return select(Problem).where(
        Problem.is_public.is_(True), Problem.id.not_in(catalogue.locked_problem_ids())
    )


@router.get("/facets", response_model=Facets, summary="Tags, sources and difficulties, with counts")
def facets(db: Session = Depends(get_db)) -> Facets:
    public = Problem.is_public.is_(True)
    tag_rows = db.execute(
        select(Tag.slug, Tag.name, func.count(problem_tags.c.problem_id))
        .join(problem_tags, problem_tags.c.tag_id == Tag.id)
        .join(Problem, Problem.id == problem_tags.c.problem_id)
        .where(public)
        .group_by(Tag.id, Tag.slug, Tag.name)
        .order_by(func.count(problem_tags.c.problem_id).desc(), Tag.name)
    ).all()
    sources = db.execute(
        select(Problem.source, func.count(Problem.id))
        .where(public, Problem.source.is_not(None))
        .group_by(Problem.source)
        .order_by(func.count(Problem.id).desc())
    ).all()
    levels = db.execute(
        select(Problem.difficulty, func.count(Problem.id)).where(public).group_by(Problem.difficulty)
    ).all()
    return Facets(
        tags=[TagCount(slug=slug, name=name, problem_count=count) for slug, name, count in tag_rows],
        sources={name: count for name, count in sources},
        difficulties={level.value: 0 for level in Difficulty} | {name: count for name, count in levels},
    )


@router.get("/daily", response_model=ProblemSummary, summary="Today's problem, the same for everyone")
def daily(
    db: Session = Depends(get_db), viewer: User | None = Depends(get_optional_user)
) -> ProblemSummary:
    problem = catalogue.daily_problem(db, _practice_pool(), utcnow().date())
    if problem is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No problems yet")
    return _summaries(db, viewer, [problem])[0]


@router.get("/random", response_model=ProblemSummary, summary="A random practice problem")
def random_problem(
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
    difficulty: list[Difficulty] | None = Query(default=None),
    tags: str | None = Query(default=None, description="Comma-separated tag slugs"),
    unsolved: bool = Query(default=True, description="Skip problems you have solved"),
) -> ProblemSummary:
    query = _practice_pool()
    if difficulty:
        query = query.where(Problem.difficulty.in_([level.value for level in difficulty]))
    if tags:
        query = query.where(*catalogue.has_all_tags([t.strip() for t in tags.split(",") if t.strip()]))
    if unsolved and viewer is not None:
        query = query.where(Problem.id.not_in(catalogue.solved_by(viewer.id)))

    problem = db.scalar(query.order_by(func.random()).limit(1))
    if problem is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="No problem matches those filters")
    return _summaries(db, viewer, [problem])[0]
