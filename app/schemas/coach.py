"""Request and response bodies for the practice coach."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CoachMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class CoachRequest(BaseModel):
    #: The conversation so far, oldest first, ending with the user's question.
    messages: list[CoachMessage] = Field(min_length=1, max_length=24)
    #: What is in the editor right now, so "why is this wrong?" just works.
    code: str | None = Field(default=None, max_length=20_000)
    language: str | None = Field(default=None, max_length=20)
    #: The last verdict the student saw, e.g. "Wrong Answer on test 3".
    verdict: str | None = Field(default=None, max_length=200)

    @field_validator("messages")
    @classmethod
    def _ends_with_the_user(cls, messages: list[CoachMessage]) -> list[CoachMessage]:
        if messages[-1].role != "user":
            raise ValueError("the last message must be the user's")
        return messages


class CoachReply(BaseModel):
    reply: str
    remaining_today: int


class CoachStatus(BaseModel):
    available: bool
    #: Why not, in words the UI can show as-is. ``None`` when available.
    reason: str | None = None
    daily_limit: int
    remaining_today: int | None = None
