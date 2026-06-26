# 🚀 Online Coding Judge

A full-stack **Online Coding Judge** built with **FastAPI, PostgreSQL, SQLAlchemy, Docker, and JWT Authentication**. The platform allows users to solve coding problems, submit solutions in multiple programming languages, automatically evaluate submissions against test cases, participate in programming contests, and view leaderboards.

---

## ✨ Features

### 👤 Authentication
- User Registration
- User Login
- JWT Authentication
- Password Hashing using bcrypt
- Protected APIs

---

### 📚 Problem Management
- Create Coding Problems
- Update Problems
- Delete Problems
- View All Problems
- View Individual Problem

---

### 🧪 Test Case Management
- Add Sample Test Cases
- Add Hidden Test Cases
- View Test Cases
- Delete Test Cases

---

### 💻 Code Submission
- Submit Source Code
- Multiple Programming Languages
    - Python
    - C++
    - Java
- Store Submission History

---

### ⚡ Online Judge
- Automatic Code Execution
- Test Case Validation
- Output Comparison
- Verdict Generation

Supported Verdicts:

- ✅ Accepted
- ❌ Wrong Answer
- ❌ Runtime Error
- ❌ Time Limit Exceeded

---

### 🏆 Contest System
- Create Contest
- Update Contest
- Delete Contest
- Join Contest
- Add Problems to Contest
- View Contest Problems

---

### 📈 Leaderboard
- Contest Rankings
- User Scores
- Problems Solved
- Ranking Generation

---

### 👨‍💻 User Dashboard
- Total Submissions
- Accepted Submissions
- Acceptance Rate
- Problems Solved
- Submission Statistics

---

### 🐳 Docker Support
- Dockerized FastAPI Application
- PostgreSQL Container
- Docker Compose Configuration

---

# 🛠 Tech Stack

## Backend

- FastAPI
- Python 3.11

## Database

- PostgreSQL
- SQLAlchemy ORM

## Authentication

- JWT
- Passlib (bcrypt)

## Code Execution

- Python
- C++
- Java

## DevOps

- Docker
- Docker Compose

---

# 📂 Project Structure

```
online-judge
│
├── app
│   ├── dependencies
│   ├── execution
│   ├── models
│   ├── routes
│   ├── schemas
│   ├── utils
│   ├── config.py
│   ├── database.py
│   └── main.py
│
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── create_tables.py
├── .env
└── README.md
```

---

# 🗄 Database Tables

The project uses the following tables:

- Users
- Problems
- Test Cases
- Submissions
- Contests
- Contest Problems
- Contest Registrations

---

# 🔄 Project Workflow

```
User

↓

Register / Login

↓

Browse Problems

↓

Submit Solution

↓

Judge Engine

↓

Execute Code

↓

Run Test Cases

↓

Generate Verdict

↓

Store Submission

↓

Leaderboard & Dashboard
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/<your-username>/online-coding-judge.git

cd online-coding-judge
```

---

## Create Virtual Environment

Windows

```bash
python -m venv venv
```

Activate

```bash
venv\Scripts\activate
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Configure Environment Variables

Create a `.env` file

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/online_judge

SECRET_KEY=your_secret_key

ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=60
```

---

## Create Database

Create PostgreSQL database

```
online_judge
```

---

## Create Tables

```bash
python create_tables.py
```

---

## Run Server

```bash
uvicorn app.main:app --reload
```

---

# 🐳 Docker Setup

Build

```bash
docker compose build
```

Run

```bash
docker compose up
```

Swagger UI

```
http://localhost:8000/docs
```

---

# 📖 API Modules

## Authentication

- POST /auth/register
- POST /auth/login

---

## Problems

- GET /problems
- GET /problems/{id}
- POST /problems
- PUT /problems/{id}
- DELETE /problems/{id}

---

## Test Cases

- POST /testcases/problem/{problem_id}
- GET /testcases/problem/{problem_id}
- DELETE /testcases/{id}

---

## Submissions

- POST /submissions
- GET /submissions

---

## Contests

- POST /contests
- GET /contests
- PUT /contests/{id}
- DELETE /contests/{id}

---

## Contest Registration

- POST /contests/{contest_id}/join

---

## Leaderboard

- GET /contests/{contest_id}/leaderboard

---

## Dashboard

- GET /dashboard

---

# 🏗 Architecture

```
                Client
                   │
                   ▼
              FastAPI APIs
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
 Authentication  Problems  Contests
        │          │          │
        └──────────┼──────────┘
                   ▼
            PostgreSQL Database
                   │
                   ▼
            Judge Engine
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
   Python        C++         Java
                   │
                   ▼
            Verdict Generator
```

---

# 🚀 Future Improvements

- Redis Queue
- Async Code Execution
- WebSocket Live Verdicts
- Admin Dashboard
- Email Verification
- Role-Based Access Control
- Code Similarity Detection
- AI-Based Code Review
- Kubernetes Deployment
- GitHub Actions CI/CD

---

# 📊 Highlights

- RESTful API Architecture
- JWT Authentication
- SQLAlchemy ORM
- Dockerized Deployment
- Multi-language Code Execution
- Contest Management
- Automated Evaluation
- Leaderboard Generation
- PostgreSQL Database Design

---

# 👨‍💻 Author

**Gajendra Dhanoliya**

- GitHub: https://github.com/dhanoliya-ji
- LinkedIn: https://www.linkedin.com/in/gajendradhanoliya-dhanoliya-813345359/

---

# ⭐ If you like this project

Give it a ⭐ on GitHub.