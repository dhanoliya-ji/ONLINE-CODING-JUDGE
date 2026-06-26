from pydantic import BaseModel


class SubmissionCreate(BaseModel):

    problem_id: int

    language: str

    source_code: str


class SubmissionResponse(BaseModel):

    id: int

    user_id: int

    problem_id: int

    language: str

    source_code: str

    status: str

    execution_time: str

    memory_used: str

    verdict: str

    score: int

    class Config:

        from_attributes = True