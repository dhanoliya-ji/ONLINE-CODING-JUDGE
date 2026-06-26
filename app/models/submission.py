from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import Text
from sqlalchemy import String
from sqlalchemy import ForeignKey

from sqlalchemy.orm import relationship

from app.models.base import Base


class Submission(Base):

    __tablename__ = "submissions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    problem_id = Column(
        Integer,
        ForeignKey("problems.id"),
        nullable=False
    )

    language = Column(
        String(20),
        nullable=False
    )

    source_code = Column(
        Text,
        nullable=False
    )

    status = Column(
        String(30),
        default="Pending"
    )

    execution_time = Column(
        String(30),
        default="0 ms"
    )

    memory_used = Column(
        String(30),
        default="0 MB"
    )

    verdict = Column(
        String(30),
        default="Pending"
    )

    score = Column(
    Integer,
    default=0
    )

    user = relationship("User")

    problem = relationship("Problem")

    