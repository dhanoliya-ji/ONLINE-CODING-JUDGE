from pydantic import BaseModel


class ProblemCreate(BaseModel):

    title: str

    description: str

    difficulty: str

    input_format: str

    output_format: str

    constraints: str

    sample_input: str

    sample_output: str


class ProblemResponse(ProblemCreate):

    id: int

    class Config:

        from_attributes = True