"""The practice coach: chat with an AI mentor about one problem.

Practice only. The coach refuses -- here on the server, not just by hiding a
button -- for a problem that belongs to a live or upcoming contest, and for
anyone registered in a contest that is running right now.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies.auth import get_current_user, get_optional_user
from app.dependencies.database import get_db
from app.models.base import utcnow
from app.models.coach_usage import CoachUsage
from app.models.contest_registration import ContestRegistration
from app.models.enums import ContestState
from app.models.problem import Problem
from app.models.user import User
from app.routes.problems import _not_found, _resolve
from app.schemas.coach import CoachReply, CoachRequest, CoachStatus
from app.services import coach as coach_service
from app.services.access import can_view_problem
from app.services.virtual import any_active_virtual

router = APIRouter(prefix="/problems", tags=["Coach"])

PROBLEM_IN_CONTEST = (
    "The coach is off for this problem: it is part of a live or upcoming contest."
)
USER_IN_CONTEST = "The coach is off while you are competing in a live contest. Good luck!"
USER_IN_VIRTUAL = "The coach is off during your virtual contest. Good luck!"


@router.get(
    "/{identifier}/coach",
    response_model=CoachStatus,
    summary="Whether the practice coach is available for this problem",
)
def coach_status(
    identifier: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
) -> CoachStatus:
    problem = _visible_problem(db, identifier, viewer)
    limit = settings.COACH_DAILY_LIMIT

    if not coach_service.is_configured():
        return CoachStatus(available=False, daily_limit=limit,
                           reason="The AI coach is not set up on this server yet.")
    blocked = _blocked_reason(db, problem, viewer)
    if blocked:
        return CoachStatus(available=False, daily_limit=limit, reason=blocked)
    if viewer is None:
        return CoachStatus(available=False, daily_limit=limit,
                           reason="Sign in to chat with the coach.")
    return CoachStatus(available=True, daily_limit=limit,
                       remaining_today=max(0, limit - _used_today(db, viewer)))


@router.post(
    "/{identifier}/coach",
    response_model=CoachReply,
    summary="Ask the practice coach about this problem",
)
def ask_coach(
    identifier: str,
    body: CoachRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CoachReply:
    problem = _visible_problem(db, identifier, user)

    blocked = _blocked_reason(db, problem, user)
    if blocked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=blocked)

    limit = settings.COACH_DAILY_LIMIT
    used = _used_today(db, user)
    if used >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You have used today's {limit} coach replies. They reset at midnight UTC.",
        )

    messages = coach_service.build_messages(
        problem,
        [message.model_dump() for message in body.messages],
        code=body.code,
        language=body.language,
        verdict=body.verdict,
    )
    try:
        reply = coach_service.complete(messages)
    except coach_service.CoachUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=str(exc)) from exc

    # Counted only once a reply exists: a provider outage costs nothing.
    _record_reply(db, user)
    return CoachReply(reply=reply, remaining_today=max(0, limit - used - 1))


# ---------------------------------------------------------------------- #
# Helpers
# ---------------------------------------------------------------------- #
def _visible_problem(db: Session, identifier: str, viewer: User | None) -> Problem:
    problem = _resolve(db, identifier)
    if not can_view_problem(db, problem, viewer):
        raise _not_found()
    return problem


def _blocked_reason(db: Session, problem: Problem, user: User | None) -> str | None:
    now = utcnow()
    for link in problem.contest_links:
        if link.contest.state_at(now) in (ContestState.RUNNING, ContestState.UPCOMING):
            return PROBLEM_IN_CONTEST

    if user is not None:
        registrations = db.scalars(
            select(ContestRegistration).where(ContestRegistration.user_id == user.id)
        )
        for registration in registrations:
            if registration.contest.state_at(now) is ContestState.RUNNING:
                return USER_IN_CONTEST
        if any_active_virtual(db, user) is not None:
            return USER_IN_VIRTUAL
    return None


def _usage_row(db: Session, user: User) -> CoachUsage | None:
    return db.scalar(
        select(CoachUsage).where(
            CoachUsage.user_id == user.id, CoachUsage.day == utcnow().date()
        )
    )


def _used_today(db: Session, user: User) -> int:
    row = _usage_row(db, user)
    return row.replies if row else 0


def _record_reply(db: Session, user: User) -> None:
    row = _usage_row(db, user)
    if row is None:
        row = CoachUsage(user_id=user.id, day=utcnow().date(), replies=0)
        db.add(row)
    row.replies += 1
    db.commit()
