from datetime import datetime
from pydantic import BaseModel


class ContestRegistrationResponse(BaseModel):

    id: int

    contest_id: int

    user_id: int

    registered_at: datetime

    class Config:

        from_attributes = True