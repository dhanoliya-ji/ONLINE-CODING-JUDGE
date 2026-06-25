from app.database import engine
from app.models.base import Base

# Import every model here
from app.models.user import User


Base.metadata.create_all(bind=engine)

print("✅ Tables created successfully!")