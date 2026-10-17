"""Discussion, list and editorial payloads."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    #: Reply to this thread (a top-level post's id).
    parent_id: int | None = None


class PostUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class PostOut(BaseModel):
    id: int
    author: str
    #: None once deleted: the post keeps its place in the thread.
    body: str | None
    created_at: datetime
    edited: bool
    votes: int
    voted_by_me: bool = False
    mine: bool = False
    replies: list[PostOut] = []


class ThreadPage(BaseModel):
    items: list[PostOut]
    total: int


class VoteOut(BaseModel):
    votes: int
    voted_by_me: bool


class ListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class ListOut(BaseModel):
    id: int
    name: str
    problem_count: int
    created_at: datetime


class EditorialOut(BaseModel):
    problem_id: int
    body: str
    author: str
    created_at: datetime


class EditorialUpdate(BaseModel):
    body: str = Field(min_length=20, max_length=30_000)
