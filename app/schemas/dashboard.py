from pydantic import BaseModel


class DashboardResponse(BaseModel):

    username: str

    email: str

    total_submissions: int

    accepted_submissions: int

    acceptance_rate: float

    problems_solved: int