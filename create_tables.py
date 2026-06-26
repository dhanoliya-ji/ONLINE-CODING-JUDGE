from app.database import engine

from app.models.base import Base

from app.models.user import User
from app.models.problem import Problem
from app.models.test_case import TestCase
from app.models.submission import Submission
from app.models.contest import Contest
from app.models.contest_problem import ContestProblem
from app.models.contest_registration import ContestRegistration

Base.metadata.create_all(bind=engine)

print("✅ Tables Created Successfully")