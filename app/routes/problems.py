from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.models.problem import Problem
from app.schemas.problem import ProblemCreate, ProblemResponse

router = APIRouter(
    prefix="/problems",
    tags=["Problems"]
)

@router.post(
    "/",
    response_model=ProblemResponse,
    status_code=201
)
def create_problem(
    problem: ProblemCreate,
    db: Session = Depends(get_db)
):

    existing_problem = db.query(Problem).filter(
        Problem.title == problem.title
    ).first()

    if existing_problem:
        raise HTTPException(
            status_code=400,
            detail="Problem already exists"
        )

    new_problem = Problem(
        title=problem.title,
        description=problem.description,
        difficulty=problem.difficulty,
        input_format=problem.input_format,
        output_format=problem.output_format,
        constraints=problem.constraints,
        sample_input=problem.sample_input,
        sample_output=problem.sample_output
    )

    db.add(new_problem)

    db.commit()

    db.refresh(new_problem)

    return new_problem