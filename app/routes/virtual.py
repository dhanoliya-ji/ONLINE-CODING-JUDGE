"""Virtual contests: replay a finished contest on your own clock.

Your result is scored exactly like the real round, relative to when you
started, and placed among the real final standings ("you would have come
7th"). Replay submissions never touch the real standings or ratings.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.base import utcnow
from app.models.community import VirtualParticipation
from app.models.contest import Contest
from app.models.enums import ContestState
from app.models.user import User
from app.schemas.leaderboard import LeaderboardEntry
from app.services.leaderboard import build_leaderboard, virtual_entry
from app.services.virtual import virtual_window

router = APIRouter(prefix="/contests", tags=["Virtual contests"])


class VirtualStatus(BaseModel):
    contest_id: int
    started_at: datetime
    ends_at: datetime
    active: bool
    #: Your result so far, scored from your own start time.
    entry: LeaderboardEntry
    #: Where that result would place among the real final standings.
    virtual_rank: int
    real_participants: int


@router.post("/{contest_id}/virtual", response_model=VirtualStatus, status_code=status.HTTP_201_CREATED,
             summary="Start a virtual replay of a finished contest")
def start_virtual(contest_id: int, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)) -> VirtualStatus:
    contest = _contest(db, contest_id)
    if contest.state is not ContestState.ENDED:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Virtual participation opens once the contest has ended")
    if _has_real_result(db, contest, user):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "You took part in this contest live, so a replay would not be fair")
    participation = VirtualParticipation(user_id=user.id, contest_id=contest.id, started_at=utcnow())
    db.add(participation)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "You have already replayed this contest") from exc
    return _status(db, contest, user, participation)


@router.get("/{contest_id}/virtual", response_model=VirtualStatus,
            summary="Your virtual replay of this contest, if any")
def get_virtual(contest_id: int, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)) -> VirtualStatus:
    contest = _contest(db, contest_id)
    participation = db.scalar(select(VirtualParticipation).where(
        VirtualParticipation.user_id == user.id, VirtualParticipation.contest_id == contest.id))
    if participation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You have not replayed this contest")
    return _status(db, contest, user, participation)


def _contest(db: Session, contest_id: int) -> Contest:
    contest = db.get(Contest, contest_id)
    if contest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contest not found")
    return contest


def _has_real_result(db: Session, contest: Contest, user: User) -> bool:
    board = build_leaderboard(db, contest)
    return any(e.user_id == user.id and any(p.attempts for p in e.problems) for e in board.entries)


def _status(db: Session, contest: Contest, user: User,
            participation: VirtualParticipation) -> VirtualStatus:
    start, end = virtual_window(contest, participation)
    entry = virtual_entry(db, contest, user, participation.started_at)
    real = [e for e in build_leaderboard(db, contest).entries if e.user_id != user.id]
    ahead = sum(1 for e in real if (e.score, -e.penalty) > (entry.score, -entry.penalty))
    entry.rank = ahead + 1
    return VirtualStatus(contest_id=contest.id, started_at=start, ends_at=end,
                         active=start <= utcnow() <= end, entry=entry,
                         virtual_rank=ahead + 1, real_participants=len(real))
