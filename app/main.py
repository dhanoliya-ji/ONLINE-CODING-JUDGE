from app.routes.test_cases import router as testcase_router
from fastapi import FastAPI

from app.routes.auth import router as auth_router
from app.routes.problems import router as problems_router
app = FastAPI(
    title="Online Coding Judge API"
)

app.include_router(auth_router)
app.include_router(problems_router)
app.include_router(testcase_router)

@app.get("/")
def root():

    return {
        "message": "Welcome to Online Coding Judge"
    }