from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import ForeignKey

from app.models.base import Base


class ContestProblem(Base):

    __tablename__ = "contest_problems"

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

    problem_id = Column(
        Integer,
        ForeignKey("problems.id"),
        nullable=False
    )