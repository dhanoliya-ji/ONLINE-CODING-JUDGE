"""Per-user analytics powering the dashboard.

Every figure is computed with a grouped SQL aggregate rather than by loading
submissions into Python, so the cost stays flat as a user's history grows.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import case, distinct, func, select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.contest_registration import ContestRegistration
from app.models.enums import Verdict
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.tag import Tag, problem_tags
from app.models.user import User
from app.schemas.dashboard import (
    DashboardResponse,
    DayActivity,
    DifficultyProgress,
    LanguageUsage,
    TagProgress,
    VerdictCount,
)
from app.schemas.submission import SubmissionSummary, with_problem_titles

RECENT_LIMIT = 10
TOP_TAGS = 12


def build_dashboard(db: Session, user: User) -> DashboardResponse:
    mine = Submission.user_id == user.id

    total = db.scalar(select(func.count(Submission.id)).where(mine)) or 0

    accepted = (
        db.scalar(
            select(func.count(Submission.id)).where(
                mine, Submission.verdict == Verdict.ACCEPTED.value
            )
        )
        or 0
    )

    problems_solved = (
        db.scalar(
            select(func.count(distinct(Submission.problem_id))).where(
                mine, Submission.verdict == Verdict.ACCEPTED.value
            )
        )
        or 0
    )

    problems_attempted = (
        db.scalar(select(func.count(distinct(Submission.problem_id))).where(mine)) or 0
    )

    contests_participated = (
        db.scalar(
            select(func.count(ContestRegistration.id)).where(
                ContestRegistration.user_id == user.id
            )
        )
        or 0
    )

    verdict_rows = db.execute(
        select(Submission.verdict, func.count(Submission.id))
        .where(mine)
        .group_by(Submission.verdict)
        .order_by(func.count(Submission.id).desc())
    ).all()

    language_rows = db.execute(
        select(
            Submission.language,
            func.count(Submission.id),
            func.sum(
                case((Submission.verdict == Verdict.ACCEPTED.value, 1), else_=0)
            ),
        )
        .where(mine)
        .group_by(Submission.language)
        .order_by(func.count(Submission.id).desc())
    ).all()

    # Solved-per-difficulty, against how many public problems exist at each.
    solved_by_difficulty = dict(
        db.execute(
            select(Problem.difficulty, func.count(distinct(Problem.id)))
            .join(Submission, Submission.problem_id == Problem.id)
            .where(mine, Submission.verdict == Verdict.ACCEPTED.value)
            .group_by(Problem.difficulty)
        ).all()
    )

    available_by_difficulty = dict(
        db.execute(
            select(Problem.difficulty, func.count(Problem.id))
            .where(Problem.is_public.is_(True))
            .group_by(Problem.difficulty)
        ).all()
    )

    recent = list(
        db.scalars(
            select(Submission)
            .where(mine)
            .order_by(Submission.created_at.desc(), Submission.id.desc())
            .limit(RECENT_LIMIT)
        )
    )

    return DashboardResponse(
        username=user.username,
        email=user.email,
        total_submissions=total,
        accepted_submissions=accepted,
        acceptance_rate=round(accepted * 100 / total, 2) if total else 0.0,
        problems_solved=problems_solved,
        problems_attempted=problems_attempted,
        contests_participated=contests_participated,
        best_contest_rank=None,
        verdict_breakdown=[
            VerdictCount(verdict=verdict, count=count) for verdict, count in verdict_rows
        ],
        difficulty_progress=[
            DifficultyProgress(
                difficulty=difficulty,
                solved=int(solved_by_difficulty.get(difficulty, 0)),
                total_available=int(count),
            )
            for difficulty, count in sorted(available_by_difficulty.items())
        ],
        language_usage=[
            LanguageUsage(
                language=language,
                submissions=int(count),
                accepted=int(accepted_count or 0),
            )
            for language, count, accepted_count in language_rows
        ],
        recent_submissions=with_problem_titles(db, [SubmissionSummary.model_validate(s) for s in recent]),
        **_activity(db, user),
        tag_progress=_tag_progress(db, user),
        global_rank=_global_rank(db, problems_solved),
        member_since=user.created_at.date().isoformat() if user.created_at else None,
    )


def _global_rank(db: Session, solved: int) -> int | None:
    """1 + the number of users who have solved more problems."""
    if solved == 0:
        return None
    per_user = (
        select(Submission.user_id, func.count(distinct(Submission.problem_id)).label("solved"))
        .where(Submission.verdict == Verdict.ACCEPTED.value)
        .group_by(Submission.user_id)
        .subquery()
    )
    ahead = db.scalar(select(func.count()).select_from(per_user).where(per_user.c.solved > solved))
    return int(ahead or 0) + 1


def _activity(db: Session, user: User) -> dict:
    """Per-day counts for the heatmap, and the streaks they imply."""
    today = utcnow().date()
    day = func.date(Submission.created_at)
    rows = db.execute(
        select(
            day,
            func.count(Submission.id),
            func.sum(case((Submission.verdict == Verdict.ACCEPTED.value, 1), else_=0)),
        )
        .where(Submission.user_id == user.id,
               Submission.created_at >= today - timedelta(days=365))
        .group_by(day)
        .order_by(day)
    ).all()
    activity = [
        DayActivity(date=str(when)[:10], submissions=int(count), accepted=int(ok or 0))
        for when, count, ok in rows
    ]

    days = sorted({date.fromisoformat(a.date) for a in activity})
    longest = run = 0
    previous = None
    for current in days:
        run = run + 1 if previous and current - previous == timedelta(days=1) else 1
        longest = max(longest, run)
        previous = current
    # A streak is still alive if the last active day is today or yesterday.
    current_streak = run if days and today - days[-1] <= timedelta(days=1) else 0
    return {"activity": activity, "current_streak": current_streak, "longest_streak": longest}


def _tag_progress(db: Session, user: User) -> list[TagProgress]:
    """Solved vs. available for the most common topics."""
    totals = db.execute(
        select(Tag.id, Tag.slug, Tag.name, func.count(problem_tags.c.problem_id))
        .join(problem_tags, problem_tags.c.tag_id == Tag.id)
        .join(Problem, Problem.id == problem_tags.c.problem_id)
        .where(Problem.is_public.is_(True))
        .group_by(Tag.id, Tag.slug, Tag.name)
        .order_by(func.count(problem_tags.c.problem_id).desc())
        .limit(TOP_TAGS)
    ).all()
    if not totals:
        return []
    solved_problems = select(Submission.problem_id).where(
        Submission.user_id == user.id, Submission.verdict == Verdict.ACCEPTED.value
    )
    solved = dict(
        db.execute(
            select(problem_tags.c.tag_id, func.count(distinct(problem_tags.c.problem_id)))
            .where(problem_tags.c.tag_id.in_([t[0] for t in totals]),
                   problem_tags.c.problem_id.in_(solved_problems))
            .group_by(problem_tags.c.tag_id)
        ).all()
    )
    return [
        TagProgress(slug=slug, name=name, solved=int(solved.get(tag_id, 0)), total=int(total))
        for tag_id, slug, name, total in totals
    ]
