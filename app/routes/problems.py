from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_admin, get_optional_user
from app.dependencies.database import get_db
from app.models.enums import Difficulty, Verdict
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.test_case import TestCase
from app.models.user import User
from app.schemas.common import Message, Page
from app.services import catalogue
from app.services.access import can_view_problem
from app.schemas.problem import (
    ProblemCreate,
    ProblemResponse,
    ProblemSummary,
    ProblemUpdate,
)
from app.utils.slug import unique_slug

router = APIRouter(prefix="/problems", tags=["Problems"])


SortKey = Literal[
    "id", "title", "difficulty", "rating", "acceptance", "popular", "newest", "relevance"
]
StatusFilter = Literal["solved", "attempted", "todo"]


@router.get(
    "",
    response_model=Page[ProblemSummary],
    summary="List problems with search, filters, sorting and pagination",
)
def list_problems(
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
    search: str | None = Query(
        default=None, max_length=200, description="Words to find in the title or statement"
    ),
    difficulty: list[Difficulty] | None = Query(
        default=None, description="Repeat to allow several: ?difficulty=Easy&difficulty=Medium"
    ),
    tags: str | None = Query(
        default=None, description="Comma-separated tag slugs; a problem must have all of them"
    ),
    source: str | None = Query(default=None, max_length=80),
    min_rating: int | None = Query(default=None, ge=0, le=5000),
    max_rating: int | None = Query(default=None, ge=0, le=5000),
    status_filter: StatusFilter | None = Query(
        default=None,
        alias="status",
        description="Your progress: solved, attempted (tried, not solved) or todo (never tried). "
        "Ignored for anonymous callers.",
    ),
    solved: bool | None = Query(
        default=None, deprecated=True, description="Use status=solved / status=todo instead"
    ),
    sort: SortKey | None = Query(
        default=None, description="Default: relevance when searching, otherwise id"
    ),
    order: Literal["asc", "desc"] = "asc",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[ProblemSummary]:
    is_admin = bool(viewer and viewer.is_admin)
    dialect = db.get_bind().dialect.name

    conditions = []
    if not is_admin:
        # Unpublished problems are invisible to everyone but admins.
        conditions.append(Problem.is_public.is_(True))
    if difficulty:
        conditions.append(Problem.difficulty.in_([level.value for level in difficulty]))
    if tags:
        conditions.extend(catalogue.has_all_tags([t.strip() for t in tags.split(",") if t.strip()]))
    if source:
        conditions.append(Problem.source == source)
    if min_rating is not None:
        conditions.append(Problem.rating >= min_rating)
    if max_rating is not None:
        conditions.append(Problem.rating <= max_rating)
    if search and search.strip():
        conditions.append(catalogue.search_condition(search, dialect))

    if status_filter is None and solved is not None:
        status_filter = "solved" if solved else "todo"
    if viewer is not None and status_filter is not None:
        solved_ids = catalogue.solved_by(viewer.id)
        if status_filter == "solved":
            conditions.append(Problem.id.in_(solved_ids))
        elif status_filter == "attempted":
            conditions.append(Problem.id.in_(catalogue.attempted_by(viewer.id)))
            conditions.append(Problem.id.not_in(solved_ids))
        else:
            conditions.append(Problem.id.not_in(catalogue.attempted_by(viewer.id)))

    total = db.scalar(select(func.count(Problem.id)).where(*conditions)) or 0

    query = select(Problem).where(*conditions)
    searching = bool(search and search.strip())
    if sort is None:
        sort = "relevance" if searching else "id"
    if sort == "relevance" and not (searching and dialect == "postgresql"):
        sort = "id"  # Relevance needs a search, and Postgres to rank it.

    descending = order == "desc"
    if sort in ("acceptance", "popular"):
        stats = catalogue.submission_stats_subquery()
        query = query.outerjoin(stats, stats.c.problem_id == Problem.id)
        total_col = func.coalesce(stats.c.total, 0)
        if sort == "popular":
            key = total_col
        else:
            key = func.coalesce(stats.c.accepted, 0) * 1.0 / func.nullif(total_col, 0)
        # Problems nobody has tried yet sort last either way.
        query = query.order_by(case((total_col > 0, 0), else_=1),
                               key.desc() if descending else key.asc(), Problem.id)
    elif sort == "relevance":
        query = query.order_by(catalogue.search_rank(search or "").desc(), Problem.id)
    else:
        key = {
            "id": Problem.id,
            "title": Problem.title,
            "difficulty": catalogue.DIFFICULTY_RANK,
            "rating": func.coalesce(Problem.rating, 0),
            "newest": Problem.created_at,
        }[sort]
        if sort == "newest":
            descending = not descending
        query = query.order_by(key.desc() if descending else key.asc(), Problem.id)

    rows = list(db.scalars(query.limit(limit).offset(offset)))
    return Page[ProblemSummary](
        items=_summaries(db, viewer, rows), total=total, limit=limit, offset=offset
    )


@router.get(
    "/{identifier}",
    response_model=ProblemResponse,
    summary="Fetch one problem by numeric id or slug",
)
def get_problem(
    identifier: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
) -> ProblemResponse:
    problem = _resolve(db, identifier)

    if not can_view_problem(db, problem, viewer):
        # 404 rather than 403: an unpublished problem should not be discoverable.
        raise _not_found()

    response = ProblemResponse.model_validate(problem)

    counts = db.execute(
        select(
            func.count(TestCase.id),
            func.sum(case((TestCase.is_sample.is_(True), 1), else_=0)),
        ).where(TestCase.problem_id == problem.id)
    ).one()
    response.total_test_case_count = int(counts[0] or 0)
    response.sample_test_case_count = int(counts[1] or 0)

    total_subs, accepted_subs = _submission_stats(db, [problem.id]).get(
        problem.id, (0, 0)
    )
    response.total_submissions = total_subs
    response.accepted_submissions = accepted_subs

    if viewer is not None:
        attempted, solved = _viewer_progress(db, viewer, [problem.id]).get(
            problem.id, (False, False)
        )
        response.attempted_by_me = attempted
        response.solved_by_me = solved

    return response


@router.post(
    "",
    response_model=ProblemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a problem (admin only)",
)
def create_problem(
    payload: ProblemCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> ProblemResponse:
    if db.scalar(select(Problem).where(func.lower(Problem.title) == payload.title.lower())):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A problem with this title already exists",
        )

    problem = Problem(
        **payload.model_dump(exclude={"difficulty", "tags"}),
        difficulty=payload.difficulty.value,
        slug=unique_slug(payload.title, lambda s: _slug_taken(db, s)),
        created_by=admin.id,
    )
    problem.tags = catalogue.resolve_tags(db, payload.tags)

    db.add(problem)
    db.commit()
    db.refresh(problem)

    return ProblemResponse.model_validate(problem)


@router.patch(
    "/{problem_id}",
    response_model=ProblemResponse,
    summary="Update a problem (admin only)",
)
def update_problem(
    problem_id: int,
    payload: ProblemUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> ProblemResponse:
    problem = db.get(Problem, problem_id)
    if problem is None:
        raise _not_found()

    changes = payload.model_dump(exclude_unset=True)

    tag_names = changes.pop("tags", None)
    if tag_names is not None:
        problem.tags = catalogue.resolve_tags(db, tag_names)

    if "difficulty" in changes and changes["difficulty"] is not None:
        changes["difficulty"] = changes["difficulty"].value

    if "title" in changes and changes["title"] and changes["title"] != problem.title:
        clash = db.scalar(
            select(Problem).where(
                func.lower(Problem.title) == changes["title"].lower(),
                Problem.id != problem.id,
            )
        )
        if clash is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A problem with this title already exists",
            )
        problem.slug = unique_slug(
            changes["title"], lambda s: _slug_taken(db, s, exclude_id=problem.id)
        )

    for field, value in changes.items():
        if value is not None:
            setattr(problem, field, value)

    db.commit()
    db.refresh(problem)
    return ProblemResponse.model_validate(problem)


@router.delete(
    "/{problem_id}", response_model=Message, summary="Delete a problem (admin only)"
)
def delete_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Message:
    problem = db.get(Problem, problem_id)
    if problem is None:
        raise _not_found()

    # Test cases, submissions and contest links cascade with the problem.
    db.delete(problem)
    db.commit()
    return Message(message="Problem deleted successfully")


# ---------------------------------------------------------------------- #
# Helpers
# ---------------------------------------------------------------------- #
def _resolve(db: Session, identifier: str) -> Problem:
    problem = (
        db.get(Problem, int(identifier))
        if identifier.isdigit()
        else db.scalar(select(Problem).where(Problem.slug == identifier))
    )
    if problem is None:
        raise _not_found()
    return problem


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found"
    )


def _summaries(db: Session, viewer: User | None, rows: list[Problem]) -> list[ProblemSummary]:
    """Rows plus their submission stats and the viewer's progress.

    Two aggregate queries for the whole page, rather than two per row.
    """
    problem_ids = [p.id for p in rows]
    stats = _submission_stats(db, problem_ids)
    mine = _viewer_progress(db, viewer, problem_ids)

    items: list[ProblemSummary] = []
    for problem in rows:
        summary = ProblemSummary.model_validate(problem)
        summary.total_submissions, summary.accepted_submissions = stats.get(problem.id, (0, 0))
        if viewer is not None:
            summary.attempted_by_me, summary.solved_by_me = mine.get(problem.id, (False, False))
        items.append(summary)
    return items


def _slug_taken(db: Session, slug: str, exclude_id: int | None = None) -> bool:
    query = select(Problem.id).where(Problem.slug == slug)
    if exclude_id is not None:
        query = query.where(Problem.id != exclude_id)
    return db.scalar(query) is not None


def _submission_stats(
    db: Session, problem_ids: list[int]
) -> dict[int, tuple[int, int]]:
    """``{problem_id: (total_submissions, accepted_submissions)}``."""
    if not problem_ids:
        return {}

    rows = db.execute(
        select(
            Submission.problem_id,
            func.count(Submission.id),
            func.sum(
                case((Submission.verdict == Verdict.ACCEPTED.value, 1), else_=0)
            ),
        )
        .where(Submission.problem_id.in_(problem_ids))
        .group_by(Submission.problem_id)
    ).all()

    return {row[0]: (int(row[1]), int(row[2] or 0)) for row in rows}


def _viewer_progress(
    db: Session, viewer: User | None, problem_ids: list[int]
) -> dict[int, tuple[bool, bool]]:
    """``{problem_id: (attempted, solved)}`` for the signed-in caller."""
    if viewer is None or not problem_ids:
        return {}

    rows = db.execute(
        select(
            Submission.problem_id,
            func.count(Submission.id),
            func.sum(
                case((Submission.verdict == Verdict.ACCEPTED.value, 1), else_=0)
            ),
        )
        .where(
            Submission.user_id == viewer.id,
            Submission.problem_id.in_(problem_ids),
        )
        .group_by(Submission.problem_id)
    ).all()

    return {row[0]: (int(row[1]) > 0, int(row[2] or 0) > 0) for row in rows}
