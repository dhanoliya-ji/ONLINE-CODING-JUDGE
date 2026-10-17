"""Ratings, virtual contests, discussions, lists and editorials."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, utcnow


class RatingChange(Base):
    """One user's rating before and after one rated contest."""

    __tablename__ = "rating_changes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    contest_id: Mapped[int] = mapped_column(ForeignKey("contests.id", ondelete="CASCADE"), index=True, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    old_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    new_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "contest_id", name="uq_rating_change_user_contest"),)


class VirtualParticipation(Base):
    """A user replaying a finished contest on their own clock."""

    __tablename__ = "virtual_participations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    contest_id: Mapped[int] = mapped_column(ForeignKey("contests.id", ondelete="CASCADE"), index=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "contest_id", name="uq_virtual_user_contest"),)


#: Who upvoted which discussion post.
discussion_votes = Table(
    "discussion_votes",
    Base.metadata,
    Column("post_id", ForeignKey("discussion_posts.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class DiscussionPost(TimestampMixin, Base):
    """A post on a problem's discussion board, or a reply to one."""

    __tablename__ = "discussion_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    #: Replies point at their thread's top post; threads are one level deep.
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("discussion_posts.id", ondelete="CASCADE"), index=True, nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    #: Deleted posts keep their place in a thread but lose their text.
    deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)


class ProblemList(Base):
    """A user's named collection of problems; "Bookmarks" is the default one."""

    __tablename__ = "problem_lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_problem_list_user_name"),)


problem_list_items = Table(
    "problem_list_items",
    Base.metadata,
    Column("list_id", ForeignKey("problem_lists.id", ondelete="CASCADE"), primary_key=True),
    Column("problem_id", ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True, index=True),
    Column("added_at", DateTime(timezone=True), default=utcnow, nullable=False),
)


class Editorial(Base):
    """An explanation of a problem's solution; AI-drafted, then cached for everyone."""

    __tablename__ = "editorials"

    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    #: Which model wrote it, or "staff" for a human-edited one.
    author: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
