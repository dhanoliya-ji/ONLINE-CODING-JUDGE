"""Who may see a problem. One rule, used by every route that serves one."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.contest import Contest
from app.models.contest_problem import ContestProblem
from app.models.problem import Problem
from app.models.user import User


def can_view_problem(db: Session, problem: Problem, viewer: User | None) -> bool:
    """Published problems are open to all, drafts to admins.

    A problem sealed for a contest opens when that contest starts: hidden
    until then so nobody can read it early, visible from then on so the
    contestants (and, afterwards, virtual participants) can solve it.
    """
    if problem.is_public or (viewer is not None and viewer.is_admin):
        return True
    started = db.scalar(
        select(ContestProblem.id)
        .join(Contest, Contest.id == ContestProblem.contest_id)
        .where(ContestProblem.problem_id == problem.id, Contest.start_time <= utcnow())
        .limit(1)
    )
    return started is not None


def in_live_contest(db: Session, problem: Problem) -> bool:
    """True while the problem belongs to a contest that has not ended.

    Spoiler-prone features (discussions, editorials, the coach) stay off
    for such problems until the contest is over.
    """
    found = db.scalar(
        select(ContestProblem.id)
        .join(Contest, Contest.id == ContestProblem.contest_id)
        .where(ContestProblem.problem_id == problem.id, Contest.end_time > utcnow())
        .limit(1)
    )
    return found is not None
