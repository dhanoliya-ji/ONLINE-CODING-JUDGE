from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import ForeignKey
from sqlalchemy import DateTime
from datetime import datetime

from app.models.base import Base


class ContestRegistration(Base):

    __tablename__ = "contest_registrations"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    contest_id = Column(
        Integer,
        ForeignKey("contests.id"),
        nullable=False
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    registered_at = Column(
        DateTime,
        default=datetime.utcnow
    )