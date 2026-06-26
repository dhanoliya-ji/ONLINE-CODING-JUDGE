
from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import Text
from sqlalchemy import Boolean
from sqlalchemy import ForeignKey

from sqlalchemy.orm import relationship

from app.models.base import Base


class TestCase(Base):

    __tablename__ = "test_cases"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    problem_id = Column(
        Integer,
        ForeignKey("problems.id"),
        nullable=False
    )

    input_data = Column(
        Text,
        nullable=False
    )

    expected_output = Column(
        Text,
        nullable=False
    )

    is_sample = Column(
        Boolean,
        default=False
    )

    problem = relationship(
    "Problem",
    back_populates="test_cases"
    )