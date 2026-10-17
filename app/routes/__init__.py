"""HTTP routers, one module per resource domain."""

from fastapi import APIRouter

from app.routes import (
    auth,
    catalogue,
    coach,
    community,
    contest_problems,
    contests,
    dashboard,
    health,
    leaderboard,
    problems,
    submissions,
    test_cases,
    virtual,
)

api_router = APIRouter()

# Order matters: `contests` declares `/contests/{identifier}` and must be
# registered before nothing else that could shadow it. The contest-problem
# routes use a deeper path, so they never collide.
api_router.include_router(health.router)
api_router.include_router(auth.router)
# Before `problems`: its /problems/{identifier} would capture /problems/daily.
api_router.include_router(catalogue.router)
api_router.include_router(problems.router)
api_router.include_router(coach.router)
api_router.include_router(community.router)
api_router.include_router(test_cases.router)
api_router.include_router(submissions.router)
api_router.include_router(contests.router)
api_router.include_router(contest_problems.router)
api_router.include_router(virtual.router)
api_router.include_router(dashboard.router)
api_router.include_router(leaderboard.router)

__all__ = ["api_router"]
