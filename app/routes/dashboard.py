from fastapi import APIRouter
from fastapi import Depends

from sqlalchemy.orm import Session

from app.dependencies.database import get_db

from app.dependencies.auth import get_current_user

from app.models.user import User

from app.models.submission import Submission

from app.schemas.dashboard import DashboardResponse


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

@router.get(
    "/",
    response_model=DashboardResponse
)
def dashboard(

    current_user: User = Depends(get_current_user),

    db: Session = Depends(get_db)

):

    submissions = db.query(
        Submission
    ).filter(
        Submission.user_id == current_user.id
    ).all()

    total = len(submissions)

    accepted = len([

        s for s in submissions

        if s.verdict == "Accepted"

    ])

    solved = len(set(

        s.problem_id

        for s in submissions

        if s.verdict == "Accepted"

    ))

    rate = 0

    if total > 0:

        rate = round(

            accepted * 100 / total,

            2

        )

    return {

        "username": current_user.username,

        "email": current_user.email,

        "total_submissions": total,

        "accepted_submissions": accepted,

        "acceptance_rate": rate,

        "problems_solved": solved

    }
