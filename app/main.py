from app.routes.test_cases import router as testcase_router
from fastapi import FastAPI
from app.routes.submissions import router as submission_router
from app.routes.auth import router as auth_router
from app.routes.problems import router as problems_router
from app.routes.contests import router as contest_router

from app.routes.dashboard import router as dashboard_router

app = FastAPI(
    title="Online Coding Judge API"
)

app.include_router(auth_router)
app.include_router(problems_router)
app.include_router(testcase_router)
app.include_router(submission_router)
app.include_router(contest_router)

app.include_router(dashboard_router)
@app.get("/")
def root():

    return {
        "message": "Welcome to Online Coding Judge"
    }