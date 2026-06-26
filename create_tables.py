from app.database import engine

from app.models.base import Base

from app.models.user import User
from app.models.problem import Problem

Base.metadata.create_all(bind=engine)

print("✅ Tables Created Successfully")