"""Virtual contests: replaying a finished contest on your own clock."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.community import VirtualParticipation
from app.models.contest import Contest
from app.models.user import User


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def virtual_window(contest: Contest, participation: VirtualParticipation) -> tuple[datetime, datetime]:
    start = _aware(participation.started_at)
    return start, start + (_aware(contest.end_time) - _aware(contest.start_time))


def active_virtual(db: Session, user: User, contest: Contest) -> VirtualParticipation | None:
    """The user's replay of ``contest`` if its clock is still running."""
    participation = db.scalar(
        select(VirtualParticipation).where(
            VirtualParticipation.user_id == user.id, VirtualParticipation.contest_id == contest.id
        )
    )
    if participation is None:
        return None
    start, end = virtual_window(contest, participation)
    return participation if start <= utcnow() <= end else None


def any_active_virtual(db: Session, user: User) -> VirtualParticipation | None:
    """Any replay the user is in the middle of (the coach stays off meanwhile)."""
    for participation, contest in db.execute(
        select(VirtualParticipation, Contest)
        .join(Contest, Contest.id == VirtualParticipation.contest_id)
        .where(VirtualParticipation.user_id == user.id)
    ):
        start, end = virtual_window(contest, participation)
        if start <= utcnow() <= end:
            return participation
    return None
