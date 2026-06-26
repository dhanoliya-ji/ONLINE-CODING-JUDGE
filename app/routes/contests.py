from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.database import get_db

from app.models.submission import Submission

from app.models.contest import Contest

from app.models.contest_registration import ContestRegistration

from app.dependencies.auth import get_current_user

from app.models.user import User

from app.schemas.leaderboard import LeaderboardEntry

from app.schemas.contest_registration import ContestRegistrationResponse

from app.schemas.contest import (
    ContestCreate,
    ContestResponse
)

router = APIRouter(
    prefix="/contests",
    tags=["Contests"]
)

@router.post(
    "/",
    response_model=ContestResponse,
    status_code=201
)
def create_contest(
    contest: ContestCreate,
    db: Session = Depends(get_db)
):

    new_contest = Contest(

        title=contest.title,

        description=contest.description,

        start_time=contest.start_time,

        end_time=contest.end_time,

        duration_minutes=contest.duration_minutes

    )

    db.add(new_contest)

    db.commit()

    db.refresh(new_contest)

    return new_contest

@router.get(
    "/",
    response_model=list[ContestResponse]
)
def get_all_contests(
    db: Session = Depends(get_db)
):

    return db.query(
        Contest
    ).all()

@router.get(
    "/{contest_id}",
    response_model=ContestResponse
)
def get_contest(
    contest_id: int,
    db: Session = Depends(get_db)
):

    contest = db.query(
        Contest
    ).filter(
        Contest.id == contest_id
    ).first()

    if contest is None:

        raise HTTPException(
            status_code=404,
            detail="Contest not found"
        )

    return contest

@router.put(
    "/{contest_id}",
    response_model=ContestResponse
)
def update_contest(
    contest_id: int,
    updated: ContestCreate,
    db: Session = Depends(get_db)
):

    contest = db.query(
        Contest
    ).filter(
        Contest.id == contest_id
    ).first()

    if contest is None:

        raise HTTPException(
            status_code=404,
            detail="Contest not found"
        )

    contest.title = updated.title
    contest.description = updated.description
    contest.start_time = updated.start_time
    contest.end_time = updated.end_time
    contest.duration_minutes = updated.duration_minutes

    db.commit()

    db.refresh(contest)

    return contest


@router.delete("/{contest_id}")
def delete_contest(
    contest_id: int,
    db: Session = Depends(get_db)
):

    contest = db.query(
        Contest
    ).filter(
        Contest.id == contest_id
    ).first()

    if contest is None:

        raise HTTPException(
            status_code=404,
            detail="Contest not found"
        )

    db.delete(contest)

    db.commit()

    return {

        "message":"Contest deleted successfully"

    }

@router.post(
    "/{contest_id}/join",
    response_model=ContestRegistrationResponse
)
def join_contest(
    contest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    contest = db.query(Contest).filter(
        Contest.id == contest_id
    ).first()

    if contest is None:
        raise HTTPException(
            status_code=404,
            detail="Contest not found"
        )

    already_joined = db.query(
        ContestRegistration
    ).filter(
        ContestRegistration.contest_id == contest_id,
        ContestRegistration.user_id == current_user.id
    ).first()

    if already_joined:
        raise HTTPException(
            status_code=400,
            detail="Already joined this contest"
        )

    registration = ContestRegistration(
        contest_id=contest_id,
        user_id=current_user.id
    )

    db.add(registration)

    db.commit()

    db.refresh(registration)

    return registration


@router.get("/{contest_id}/participants")
def contest_participants(
    contest_id: int,
    db: Session = Depends(get_db)
):

    registrations = db.query(
        ContestRegistration
    ).filter(
        ContestRegistration.contest_id == contest_id
    ).all()

    participants = []

    for registration in registrations:

        user = db.query(User).filter(
            User.id == registration.user_id
        ).first()

        if user:
            participants.append({
                "id": user.id,
                "username": user.username,
                "email": user.email
            })

    return participants

@router.get(
    "/{contest_id}/leaderboard",
    response_model=list[LeaderboardEntry]
)
def contest_leaderboard(
    contest_id: int,
    db: Session = Depends(get_db)
):

    registrations = db.query(
        ContestRegistration
    ).filter(
        ContestRegistration.contest_id == contest_id
    ).all()

    leaderboard = []

    for registration in registrations:

        user = db.query(User).filter(
            User.id == registration.user_id
        ).first()

        submissions = db.query(
            Submission
        ).filter(
            Submission.user_id == registration.user_id,
            Submission.verdict == "Accepted"
        ).all()

        solved = len(submissions)

        score = solved * 100

        leaderboard.append({

            "username": user.username,

            "solved": solved,

            "score": score

        })

    leaderboard.sort(

        key=lambda x: x["score"],

        reverse=True

    )

    result = []

    rank = 1

    for item in leaderboard:

        result.append({

            "rank": rank,

            **item

        })

        rank += 1

    return result