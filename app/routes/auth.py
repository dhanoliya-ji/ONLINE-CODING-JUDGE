from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.utils.security import hash_password

from app.schemas.user import UserLogin
from app.schemas.user import Token

from app.utils.security import verify_password
from app.utils.jwt import create_access_token

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# print("✅ auth.py loaded")
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201
)

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201
)
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    print("STEP 1")

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    print("STEP 2")

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    print("STEP 3")

    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password)
    )

    print("STEP 4")

    db.add(new_user)

    print("STEP 5")

    db.commit()

    print("STEP 6")

    db.refresh(new_user)

    print("STEP 7")

    return new_user

@router.post(
    "/login",
    response_model=Token
)
def login(
    user: UserLogin,
    db: Session = Depends(get_db)
):

    db_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if not db_user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        user.password,
        db_user.hashed_password
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token(
        {
            "sub": db_user.email
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }

@router.get(
    "/me",
    response_model=UserResponse
)
def current_user(
    user: User = Depends(get_current_user)
):

    return user