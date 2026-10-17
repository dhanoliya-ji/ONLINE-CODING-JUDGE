"""The global leaderboard: everyone ranked by problems solved."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.models.enums import Verdict
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.user import User
from app.schemas.common import Page

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


class LeaderboardRow(BaseModel):
    rank: int
    username: str
    solved: int
    easy: int
    medium: int
    hard: int
    submissions: int
    acceptance_rate: float


@router.get("", response_model=Page[LeaderboardRow], summary="Everyone, ranked by problems solved")
def leaderboard(
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[LeaderboardRow]:
    accepted = Submission.verdict == Verdict.ACCEPTED.value
    # One row per (user, problem) they have solved, practice or contest.
    solves = (
        select(Submission.user_id, Submission.problem_id, Problem.difficulty)
        .join(Problem, Problem.id == Submission.problem_id)
        .where(accepted)
        .distinct()
        .subquery()
    )

    def by(level: str):
        return func.sum(case((solves.c.difficulty == level, 1), else_=0))

    solved = (
        select(
            solves.c.user_id,
            func.count().label("solved"),
            by("Easy").label("easy"),
            by("Medium").label("medium"),
            by("Hard").label("hard"),
        )
        .group_by(solves.c.user_id)
        .subquery()
    )
    totals = (
        select(
            Submission.user_id,
            func.count(Submission.id).label("submissions"),
            func.sum(case((accepted, 1), else_=0)).label("accepted"),
        )
        .group_by(Submission.user_id)
        .subquery()
    )

    base = (
        select(User.username, solved.c.solved, solved.c.easy, solved.c.medium, solved.c.hard,
               totals.c.submissions, totals.c.accepted)
        .join(solved, solved.c.user_id == User.id)
        .join(totals, totals.c.user_id == User.id)
        .where(User.is_active.is_(True))
    )
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.execute(
        base.order_by(solved.c.solved.desc(), solved.c.hard.desc(), solved.c.medium.desc(),
                      totals.c.submissions.asc(), User.username)
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        LeaderboardRow(
            rank=offset + index + 1,
            username=row.username,
            solved=int(row.solved),
            easy=int(row.easy or 0),
            medium=int(row.medium or 0),
            hard=int(row.hard or 0),
            submissions=int(row.submissions),
            acceptance_rate=round(100 * int(row.accepted or 0) / int(row.submissions), 1),
        )
        for index, row in enumerate(rows)
    ]
    return Page[LeaderboardRow](items=items, total=total, limit=limit, offset=offset)
