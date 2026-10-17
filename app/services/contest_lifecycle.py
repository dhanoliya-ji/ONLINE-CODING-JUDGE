"""What happens to contests over time, without a scheduler process.

The free host has no cron, so this runs inside ordinary requests (contest
pages, at most once a minute per worker) and once on start-up:

* **Finalise** every contest that has ended: rate it, and publish the
  problems an automatic contest kept hidden until its start.
* **Schedule** the next weekly round when none is upcoming: Sunday 14:00 UTC,
  90 minutes, four problems the library has not used yet (Easy, Medium,
  Medium, Hard), hidden until the round begins.

Both steps are idempotent, and both are safe to run concurrently: the worst
case is a no-op.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models.base import utcnow
from app.models.community import RatingChange
from app.models.contest import Contest
from app.models.contest_problem import ContestProblem
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.user import User
from app.services.leaderboard import build_leaderboard
from app.services.rating import INITIAL_RATING, Standing, rating_changes
from app.utils.slug import unique_slug

logger = logging.getLogger(__name__)

WEEKLY_DURATION = timedelta(minutes=90)
WEEKLY_SET = [("Easy", 100), ("Medium", 200), ("Medium", 300), ("Hard", 400)]
_MIN_INTERVAL_S = 60
_last_run = 0.0


def maintain(db: Session, *, force: bool = False) -> None:
    """Finalise ended contests and keep a weekly round scheduled."""
    global _last_run
    if not force and time.monotonic() - _last_run < _MIN_INTERVAL_S:
        return
    _last_run = time.monotonic()
    try:
        finalise_ended(db)
        if settings.WEEKLY_CONTESTS:
            schedule_weekly(db)
    except Exception:  # noqa: BLE001 - housekeeping must never break a page
        db.rollback()
        logger.exception("Contest maintenance failed")


# ------------------------------------------------------------ finalise --
def finalise_ended(db: Session) -> None:
    now = utcnow()
    ended = list(db.scalars(
        select(Contest).where(Contest.end_time < now, Contest.finalized_at.is_(None))
    ))
    for contest in ended:
        if contest.is_auto:
            for link in contest.problem_links:
                link.problem.is_public = True
        if contest.rated:
            rate_contest(db, contest)
        contest.finalized_at = now
        db.commit()
        logger.info("Finalised contest %s (%s)", contest.id, contest.title)


def rate_contest(db: Session, contest: Contest) -> None:
    """Apply rating changes for everyone who submitted at least once."""
    if db.scalar(select(RatingChange.id).where(RatingChange.contest_id == contest.id)):
        return  # already rated

    board = build_leaderboard(db, contest)
    competed = {e.user_id: e.rank for e in board.entries if any(p.attempts for p in e.problems)}
    if not competed:
        return
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(competed)))}
    standings = [
        Standing(user_id=uid, rank=rank, rating=users[uid].rating or INITIAL_RATING)
        for uid, rank in competed.items()
    ]
    new = rating_changes(standings)
    for standing in standings:
        user = users[standing.user_id]
        user.rating = new[standing.user_id]
        user.max_rating = max(user.max_rating or 0, user.rating)
        db.add(RatingChange(user_id=user.id, contest_id=contest.id, rank=standing.rank,
                            old_rating=standing.rating, new_rating=user.rating))


# ------------------------------------------------------------ schedule --
def next_weekly_start(now: datetime) -> datetime:
    """The next Sunday 14:00 UTC at least a day away."""
    days = (6 - now.weekday()) % 7  # Monday is 0, Sunday is 6
    start = (now + timedelta(days=days)).replace(hour=14, minute=0, second=0, microsecond=0)
    while start - now < timedelta(days=1):
        start += timedelta(days=7)
    return start


def schedule_weekly(db: Session) -> Contest | None:
    now = utcnow()
    upcoming = db.scalar(
        select(Contest.id).where(Contest.is_auto.is_(True), Contest.start_time > now)
    )
    if upcoming is not None:
        return None

    picks = _fresh_problems(db)
    if picks is None:
        return None  # the library is too small to build a round

    start = next_weekly_start(now)
    number = (db.scalar(select(func.count(Contest.id)).where(Contest.is_auto.is_(True))) or 0) + 1
    title = f"Weekly Round #{number}"
    contest = Contest(
        title=title,
        slug=unique_slug(title, lambda s: db.scalar(select(Contest.id).where(Contest.slug == s)) is not None),
        description=(
            "Four problems in 90 minutes, from easy to hard. Rated: your rating "
            "moves when the round ends. Problems are revealed at the start and "
            "join the practice library afterwards."
        ),
        start_time=start,
        end_time=start + WEEKLY_DURATION,
        is_auto=True,
        rated=True,
    )
    db.add(contest)
    db.flush()
    for index, (problem, points) in enumerate(picks):
        problem.is_public = False  # sealed until the round starts
        db.add(ContestProblem(contest_id=contest.id, problem_id=problem.id,
                              label=chr(ord("A") + index), order_index=index, points=points))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # another worker scheduled it first
        return None
    logger.info("Scheduled %s for %s", title, start.isoformat())
    return contest


def _fresh_problems(db: Session) -> list[tuple[Problem, int]] | None:
    """Imported problems nobody has submitted to and no contest has used."""
    used = select(ContestProblem.problem_id)
    tried = select(Submission.problem_id)
    picks: list[tuple[Problem, int]] = []
    taken: set[int] = set()
    for difficulty, points in WEEKLY_SET:
        problem = db.scalar(
            select(Problem)
            .where(
                Problem.is_public.is_(True),
                Problem.external_id.is_not(None),
                Problem.difficulty == difficulty,
                Problem.id.not_in(used),
                Problem.id.not_in(tried),
                Problem.id.not_in(taken or {0}),
            )
            .order_by(func.random())
            .limit(1)
        )
        if problem is None:
            return None
        picks.append((problem, points))
        taken.add(problem.id)
    return picks

