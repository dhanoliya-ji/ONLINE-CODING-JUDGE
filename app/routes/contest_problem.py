from app.models.problem import Problem
from app.models.contest_problem import ContestProblem

from app.schemas.contest_problem import (
    ContestProblemCreate,
    ContestProblemResponse
)

@router.post(
    "/add-problem",
    response_model=ContestProblemResponse,
    status_code=201
)
def add_problem_to_contest(
    mapping: ContestProblemCreate,
    db: Session = Depends(get_db)
):

    contest = db.query(Contest).filter(
        Contest.id == mapping.contest_id
    ).first()

    if contest is None:
        raise HTTPException(
            status_code=404,
            detail="Contest not found"
        )

    problem = db.query(Problem).filter(
        Problem.id == mapping.problem_id
    ).first()

    if problem is None:
        raise HTTPException(
            status_code=404,
            detail="Problem not found"
        )

    exists = db.query(ContestProblem).filter(
        ContestProblem.contest_id == mapping.contest_id,
        ContestProblem.problem_id == mapping.problem_id
    ).first()

    if exists:
        raise HTTPException(
            status_code=400,
            detail="Problem already added"
        )

    contest_problem = ContestProblem(
        contest_id=mapping.contest_id,
        problem_id=mapping.problem_id
    )

    db.add(contest_problem)

    db.commit()

    db.refresh(contest_problem)

    return contest_problem

@router.get("/{contest_id}/problems")
def get_contest_problems(
    contest_id: int,
    db: Session = Depends(get_db)
):

    mappings = db.query(
        ContestProblem
    ).filter(
        ContestProblem.contest_id == contest_id
    ).all()

    problems = []

    for mapping in mappings:

        problem = db.query(
            Problem
        ).filter(
            Problem.id == mapping.problem_id
        ).first()

        if problem:
            problems.append(problem)

    return problems