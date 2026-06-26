from sqlalchemy import Column, Integer, String, Text

from app.models.base import Base


class Problem(Base):
    __tablename__ = "problems"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    title = Column(
        String(255),
        unique=True,
        nullable=False
    )

    description = Column(
        Text,
        nullable=False
    )

    difficulty = Column(
        String(20),
        nullable=False
    )

    input_format = Column(
        Text,
        nullable=False
    )

    output_format = Column(
        Text,
        nullable=False
    )

    constraints = Column(
        Text,
        nullable=False
    )

    sample_input = Column(
        Text,
        nullable=False
    )

    sample_output = Column(
        Text,
        nullable=False
    )