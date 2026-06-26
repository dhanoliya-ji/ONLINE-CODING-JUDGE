from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_user

from app.models.problem import Problem
from app.models.submission import Submission
from app.models.user import User

from app.models.test_case import TestCase
from app.execution.judge import judge_submission

from app.schemas.submission import (
    SubmissionCreate,
    SubmissionResponse
)

router = APIRouter(
    prefix="/submissions",
    tags=["Submissions"]
)

@router.post(
    "/",
    response_model=SubmissionResponse,
    status_code=201
)
def create_submission(
    submission: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    problem = db.query(Problem).filter(
        Problem.id == submission.problem_id
    ).first()

    if problem is None:

        raise HTTPException(
            status_code=404,
            detail="Problem not found"
        )

    new_submission = Submission(

        user_id=current_user.id,

        problem_id=submission.problem_id,

        language=submission.language,

        source_code=submission.source_code,

        status="Pending",

        verdict="Pending"

    )

    db.add(new_submission)

    db.commit()

    db.refresh(new_submission)

    testcases = db.query(
        TestCase
    ).filter(
        TestCase.problem_id == submission.problem_id
    ).all()

    result = judge_submission(

        submission.source_code,

        testcases

    )

    new_submission.verdict = result["verdict"]

    new_submission.score = result["score"]

    new_submission.execution_time = f'{result["execution_time"]:.2f} ms'

    new_submission.memory_used = result["memory_used"]

    new_submission.status = "Completed"

    db.commit()

    db.refresh(new_submission)

    return new_submission

@router.get(
    "/",
    response_model=list[SubmissionResponse]
)
def my_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    submissions = db.query(
        Submission
    ).filter(
        Submission.user_id == current_user.id
    ).all()

    return submissions