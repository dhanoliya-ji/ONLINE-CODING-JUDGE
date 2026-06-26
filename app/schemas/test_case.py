from pydantic import BaseModel


class TestCaseCreate(BaseModel):

    input_data: str

    expected_output: str

    is_sample: bool = False


class TestCaseResponse(BaseModel):

    id: int

    problem_id: int

    input_data: str

    expected_output: str

    is_sample: bool

    class Config:

        from_attributes = True