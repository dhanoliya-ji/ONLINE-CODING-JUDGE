from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.models.problem import Problem
from app.models.test_case import TestCase
from app.schemas.test_case import (
    TestCaseCreate,
    TestCaseResponse
)

router = APIRouter(
    prefix="/testcases",
    tags=["Test Cases"]
)

@router.post(
    "/problem/{problem_id}",
    response_model=TestCaseResponse,
    status_code=201
)
def create_test_case(
    problem_id: int,
    testcase: TestCaseCreate,
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

    new_testcase = TestCase(
        problem_id=problem_id,
        input_data=testcase.input_data,
        expected_output=testcase.expected_output,
        is_sample=testcase.is_sample
    )

    db.add(new_testcase)

    db.commit()

    db.refresh(new_testcase)

    return new_testcase

@router.get(
    "/problem/{problem_id}",
    response_model=list[TestCaseResponse]
)
def get_testcases(
    problem_id: int,
    db: Session = Depends(get_db)
):

    return db.query(TestCase).filter(
        TestCase.problem_id == problem_id
    ).all()

@router.delete("/{testcase_id}")
def delete_testcase(
    testcase_id: int,
    db: Session = Depends(get_db)
):

    testcase = db.query(TestCase).filter(
        TestCase.id == testcase_id
    ).first()

    if testcase is None:

        raise HTTPException(
            status_code=404,
            detail="Test case not found"
        )

    db.delete(testcase)

    db.commit()

    return {
        "message": "Test case deleted successfully"
    }

