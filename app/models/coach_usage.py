from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CoachUsage(Base):
    """How many coach replies one user has had on one UTC day.

    The free AI tiers behind the coach have daily quotas shared by everyone,
    so each user gets a fair slice rather than one chatty user exhausting it.
    """

    __tablename__ = "coach_usage"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)
    replies: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "day", name="uq_coach_usage_user_day"),)
