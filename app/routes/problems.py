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

@router.get(
    "/",
    response_model=list[ProblemResponse]
)
def get_all_problems(
    db: Session = Depends(get_db)
):

    problems = db.query(Problem).all()

    return problems

@router.get(
    "/{problem_id}",
    response_model=ProblemResponse
)
def get_problem(
    problem_id: int,
    db: Session = Depends(get_db)
):

    problem = db.query(Problem).filter(
        Problem.id == problem_id
    ).first()

    if problem is None:

        raise HTTPException(
            status_code=404,
            detail="Problem not found"
        )

    return problem