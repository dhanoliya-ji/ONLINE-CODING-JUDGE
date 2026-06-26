from datetime import datetime

from pydantic import BaseModel


class ContestCreate(BaseModel):

    title: str

    description: str

    start_time: datetime

    end_time: datetime

    duration_minutes: int


class ContestResponse(ContestCreate):

    id: int

    class Config:

        from_attributes = True