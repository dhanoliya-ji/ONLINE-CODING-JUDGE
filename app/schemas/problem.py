from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, computed_field

from app.models.enums import Difficulty
from app.schemas.common import ORMModel


class ProblemBase(BaseModel):
    title: str = Field(min_length=3, max_length=255, examples=["Two Sum"])
    description: str = Field(min_length=10)
    difficulty: Difficulty = Difficulty.EASY
    input_format: str
    output_format: str
    constraints: str
    sample_input: str
    sample_output: str
    time_limit_ms: int = Field(default=2000, ge=100, le=15_000)
    memory_limit_mb: int = Field(default=128, ge=16, le=1024)
    is_public: bool = True
    #: Topic names, e.g. ["Dynamic Programming", "Greedy"]; created on demand.
    tags: list[str] = Field(default_factory=list, max_length=12)
    source: str | None = Field(default=None, max_length=80)
    source_url: str | None = Field(default=None, max_length=500)
    license: str | None = Field(default=None, max_length=120)


class ProblemCreate(ProblemBase):
    pass


class ProblemUpdate(BaseModel):
    """Every field optional - this is a genuine PATCH."""

    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, min_length=10)
    difficulty: Difficulty | None = None
    input_format: str | None = None
    output_format: str | None = None
    constraints: str | None = None
    sample_input: str | None = None
    sample_output: str | None = None
    time_limit_ms: int | None = Field(default=None, ge=100, le=15_000)
    memory_limit_mb: int | None = Field(default=None, ge=16, le=1024)
    is_public: bool | None = None
    tags: list[str] | None = Field(default=None, max_length=12)
    source: str | None = Field(default=None, max_length=80)
    source_url: str | None = Field(default=None, max_length=500)
    license: str | None = Field(default=None, max_length=120)


class TagOut(ORMModel):
    slug: str
    name: str


class TagCount(TagOut):
    problem_count: int


class Facets(BaseModel):
    """What the problem list can be filtered by, with counts."""

    tags: list[TagCount]
    sources: dict[str, int]
    difficulties: dict[str, int]


class ProblemSummary(ORMModel):
    """Row shape for the problem list - deliberately omits the statement."""

    id: int
    slug: str
    title: str
    difficulty: str
    time_limit_ms: int
    memory_limit_mb: int
    created_at: datetime
    tags: list[TagOut] = []
    source: str | None = None

    # Populated per-request for authenticated callers.
    solved_by_me: bool | None = None
    attempted_by_me: bool | None = None
    total_submissions: int | None = None
    accepted_submissions: int | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def acceptance_rate(self) -> float | None:
        """Accepted share of submissions, 0-100, or None before any."""
        if not self.total_submissions:
            return None
        return round(100 * (self.accepted_submissions or 0) / self.total_submissions, 1)


class ProblemResponse(ProblemSummary):
    description: str
    input_format: str
    output_format: str
    constraints: str
    sample_input: str
    sample_output: str
    is_public: bool
    source_url: str | None = None
    license: str | None = None
    sample_test_case_count: int = 0
    total_test_case_count: int = 0
