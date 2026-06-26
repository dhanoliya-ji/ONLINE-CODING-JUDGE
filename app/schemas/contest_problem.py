from pydantic import BaseModel


class ContestProblemCreate(BaseModel):

    contest_id: int

    problem_id: int


class ContestProblemResponse(ContestProblemCreate):

    id: int

    class Config:

        from_attributes = True