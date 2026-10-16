from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.submission import SubmissionSummary


class VerdictCount(BaseModel):
    verdict: str
    count: int


class DifficultyProgress(BaseModel):
    difficulty: str
    solved: int
    total_available: int


class LanguageUsage(BaseModel):
    language: str
    submissions: int
    accepted: int


class DayActivity(BaseModel):
    date: str = Field(description="UTC day, YYYY-MM-DD")
    submissions: int
    accepted: int


class TagProgress(BaseModel):
    slug: str
    name: str
    solved: int
    total: int


class DashboardResponse(BaseModel):
    username: str
    email: str

    total_submissions: int
    accepted_submissions: int
    acceptance_rate: float = Field(description="Accepted / total, as a percentage")
    problems_solved: int
    problems_attempted: int

    contests_participated: int
    best_contest_rank: int | None = None

    verdict_breakdown: list[VerdictCount] = []
    difficulty_progress: list[DifficultyProgress] = []
    language_usage: list[LanguageUsage] = []
    recent_submissions: list[SubmissionSummary] = []

    #: Days with at least one submission over the last year, oldest first.
    activity: list[DayActivity] = []
    current_streak: int = Field(0, description="Consecutive days up to today (or yesterday) with a submission")
    longest_streak: int = 0
    #: Position on the global leaderboard (by problems solved), if ranked.
    global_rank: int | None = None
    member_since: str | None = None
    tag_progress: list[TagProgress] = []
