from __future__ import annotations

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

#: Many-to-many link between problems and their topic tags.
problem_tags = Table(
    "problem_tags",
    Base.metadata,
    Column("problem_id", ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True, index=True),
)


class Tag(Base):
    """A topic such as "Dynamic Programming" or "Graphs"."""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Tag {self.slug}>"
