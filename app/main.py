from fastapi import FastAPI

app = FastAPI(
    title="Online Coding Judge API",
    description="Backend API for an Online Coding Judge",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "Welcome to the Online Coding Judge!"
    }