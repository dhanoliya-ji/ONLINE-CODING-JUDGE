from pydantic import BaseModel


class LeaderboardEntry(BaseModel):

    rank: int

    username: str

    solved: int

    score: int