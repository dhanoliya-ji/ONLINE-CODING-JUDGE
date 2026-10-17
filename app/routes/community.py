"""Discussions, problem lists and editorials."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_admin, get_current_user, get_optional_user
from app.dependencies.database import get_db
from app.models.base import utcnow
from app.models.community import (
    DiscussionPost,
    Editorial,
    ProblemList,
    discussion_votes,
    problem_list_items,
)
from app.models.problem import Problem
from app.models.user import User
from app.config import settings
from app.routes.coach import _record_reply, _used_today
from app.routes.problems import _not_found, _resolve, _summaries
from app.schemas.common import Message, Page
from app.schemas.community import (
    EditorialOut,
    EditorialUpdate,
    ListCreate,
    ListOut,
    PostCreate,
    PostOut,
    PostUpdate,
    ThreadPage,
    VoteOut,
)
from app.schemas.problem import ProblemSummary
from app.services import coach as coach_service
from app.services.access import can_view_problem, in_live_contest

router = APIRouter(tags=["Community"])

POSTS_PER_HOUR = 20
DEFAULT_LIST = "Bookmarks"
SPOILER_GUARD = "Hidden while this problem is part of a live or upcoming contest."


def _problem(db: Session, identifier: str, viewer: User | None) -> Problem:
    problem = _resolve(db, identifier)
    if not can_view_problem(db, problem, viewer):
        raise _not_found()
    return problem


def _no_spoilers(db: Session, problem: Problem) -> None:
    if in_live_contest(db, problem):
        raise HTTPException(status.HTTP_403_FORBIDDEN, SPOILER_GUARD)


# ============================================================ discussions
@router.get("/problems/{identifier}/discussions", response_model=ThreadPage,
            summary="A problem's discussion threads, with replies")
def list_threads(
    identifier: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
    sort: str = Query(default="top", pattern="^(top|new)$"),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
) -> ThreadPage:
    problem = _problem(db, identifier, viewer)
    _no_spoilers(db, problem)

    top_level = (DiscussionPost.problem_id == problem.id, DiscussionPost.parent_id.is_(None))
    total = db.scalar(select(func.count(DiscussionPost.id)).where(*top_level)) or 0
    votes = (
        select(func.count()).where(discussion_votes.c.post_id == DiscussionPost.id)
        .correlate(DiscussionPost).scalar_subquery()
    )
    order = (votes.desc(), DiscussionPost.created_at.desc()) if sort == "top" else (DiscussionPost.created_at.desc(),)
    threads = list(db.scalars(select(DiscussionPost).where(*top_level).order_by(*order).limit(limit).offset(offset)))
    replies = list(db.scalars(
        select(DiscussionPost)
        .where(DiscussionPost.parent_id.in_([t.id for t in threads] or [0]))
        .order_by(DiscussionPost.created_at)
    ))
    return ThreadPage(items=_render(db, threads, replies, viewer), total=total)


@router.post("/problems/{identifier}/discussions", response_model=PostOut,
             status_code=status.HTTP_201_CREATED, summary="Start a thread or reply to one")
def create_post(identifier: str, body: PostCreate, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)) -> PostOut:
    problem = _problem(db, identifier, user)
    _no_spoilers(db, problem)

    recent = db.scalar(select(func.count(DiscussionPost.id)).where(
        DiscussionPost.user_id == user.id, DiscussionPost.created_at > utcnow() - timedelta(hours=1)))
    if (recent or 0) >= POSTS_PER_HOUR:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            f"You can post {POSTS_PER_HOUR} times an hour. Please wait a little.")
    if body.parent_id is not None:
        parent = db.get(DiscussionPost, body.parent_id)
        if parent is None or parent.problem_id != problem.id or parent.parent_id is not None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Replies attach to a thread on this problem")

    post = DiscussionPost(problem_id=problem.id, user_id=user.id, parent_id=body.parent_id,
                          body=body.body.strip())
    db.add(post)
    db.commit()
    db.refresh(post)
    return _render(db, [post], [], user)[0]


@router.patch("/discussions/{post_id}", response_model=PostOut, summary="Edit your post")
def edit_post(post_id: int, body: PostUpdate, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)) -> PostOut:
    post = _own_post(db, post_id, user)
    post.body = body.body.strip()
    db.commit()
    db.refresh(post)
    return _render(db, [post], [], user)[0]


@router.delete("/discussions/{post_id}", response_model=Message, summary="Delete your post")
def delete_post(post_id: int, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)) -> Message:
    post = _own_post(db, post_id, user, admin_ok=True)
    post.deleted = True
    post.body = ""
    db.commit()
    return Message(message="Post deleted")


@router.post("/discussions/{post_id}/vote", response_model=VoteOut, summary="Toggle your upvote")
def vote(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> VoteOut:
    post = db.get(DiscussionPost, post_id)
    if post is None or post.deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    mine = (discussion_votes.c.post_id == post.id, discussion_votes.c.user_id == user.id)
    if db.scalar(select(func.count()).where(*mine)):
        db.execute(delete(discussion_votes).where(*mine))
        voted = False
    else:
        db.execute(insert(discussion_votes).values(post_id=post.id, user_id=user.id))
        voted = True
    db.commit()
    count = db.scalar(select(func.count()).where(discussion_votes.c.post_id == post.id)) or 0
    return VoteOut(votes=count, voted_by_me=voted)


def _own_post(db: Session, post_id: int, user: User, admin_ok: bool = False) -> DiscussionPost:
    post = db.get(DiscussionPost, post_id)
    if post is None or post.deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    if post.user_id != user.id and not (admin_ok and user.is_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only change your own posts")
    return post


def _render(db: Session, threads: list[DiscussionPost], replies: list[DiscussionPost],
            viewer: User | None) -> list[PostOut]:
    posts = threads + replies
    ids = [p.id for p in posts] or [0]
    authors = dict(db.execute(select(User.id, User.username).where(User.id.in_({p.user_id for p in posts} or {0}))).all())
    counts = dict(db.execute(
        select(discussion_votes.c.post_id, func.count()).where(discussion_votes.c.post_id.in_(ids))
        .group_by(discussion_votes.c.post_id)).all())
    voted = set()
    if viewer is not None:
        voted = set(db.scalars(select(discussion_votes.c.post_id).where(
            discussion_votes.c.post_id.in_(ids), discussion_votes.c.user_id == viewer.id)))

    def out(post: DiscussionPost) -> PostOut:
        return PostOut(
            id=post.id, author=authors.get(post.user_id, "deleted user"),
            body=None if post.deleted else post.body, created_at=post.created_at,
            edited=post.updated_at is not None and post.created_at is not None
            and (post.updated_at - post.created_at).total_seconds() > 5,
            votes=int(counts.get(post.id, 0)), voted_by_me=post.id in voted,
            mine=viewer is not None and post.user_id == viewer.id,
        )

    rendered = {t.id: out(t) for t in threads}
    for reply in replies:
        if reply.parent_id in rendered:
            rendered[reply.parent_id].replies.append(out(reply))
    return [rendered[t.id] for t in threads]


# ================================================================== lists
@router.get("/lists", response_model=list[ListOut], summary="Your problem lists")
def my_lists(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ListOut]:
    _ensure_default(db, user)
    counts = (
        select(problem_list_items.c.list_id, func.count().label("n"))
        .group_by(problem_list_items.c.list_id).subquery()
    )
    rows = db.execute(
        select(ProblemList, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.list_id == ProblemList.id)
        .where(ProblemList.user_id == user.id)
        .order_by(ProblemList.name != DEFAULT_LIST, ProblemList.created_at)
    ).all()
    return [ListOut(id=pl.id, name=pl.name, problem_count=int(n), created_at=pl.created_at) for pl, n in rows]


@router.post("/lists", response_model=ListOut, status_code=status.HTTP_201_CREATED, summary="Create a list")
def create_list(body: ListCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ListOut:
    if (db.scalar(select(func.count(ProblemList.id)).where(ProblemList.user_id == user.id)) or 0) >= 50:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can have up to 50 lists")
    problem_list = ProblemList(user_id=user.id, name=" ".join(body.name.split()))
    db.add(problem_list)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a list with that name") from exc
    return ListOut(id=problem_list.id, name=problem_list.name, problem_count=0, created_at=problem_list.created_at)


@router.delete("/lists/{list_id}", response_model=Message, summary="Delete a list")
def delete_list(list_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Message:
    db.delete(_own_list(db, list_id, user))
    db.commit()
    return Message(message="List deleted")


@router.get("/lists/{list_id}/problems", response_model=Page[ProblemSummary], summary="Problems in a list")
def list_problems_in(list_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user),
                     limit: int = Query(default=50, ge=1, le=100),
                     offset: int = Query(default=0, ge=0)) -> Page[ProblemSummary]:
    _own_list(db, list_id, user)
    in_list = select(problem_list_items.c.problem_id).where(problem_list_items.c.list_id == list_id)
    total = db.scalar(select(func.count()).select_from(in_list.subquery())) or 0
    rows = list(db.scalars(
        select(Problem)
        .join(problem_list_items, problem_list_items.c.problem_id == Problem.id)
        .where(problem_list_items.c.list_id == list_id)
        .order_by(problem_list_items.c.added_at.desc())
        .limit(limit).offset(offset)
    ))
    return Page[ProblemSummary](items=_summaries(db, user, rows), total=total, limit=limit, offset=offset)


@router.put("/lists/{list_id}/problems/{problem_id}", response_model=Message, summary="Add a problem to a list")
def add_to_list(list_id: int, problem_id: int, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)) -> Message:
    _own_list(db, list_id, user)
    problem = db.get(Problem, problem_id)
    if problem is None or not can_view_problem(db, problem, user):
        raise _not_found()
    exists = db.scalar(select(func.count()).where(
        problem_list_items.c.list_id == list_id, problem_list_items.c.problem_id == problem_id))
    if not exists:
        db.execute(insert(problem_list_items).values(list_id=list_id, problem_id=problem_id, added_at=utcnow()))
        db.commit()
    return Message(message="Added")


@router.delete("/lists/{list_id}/problems/{problem_id}", response_model=Message,
               summary="Remove a problem from a list")
def remove_from_list(list_id: int, problem_id: int, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)) -> Message:
    _own_list(db, list_id, user)
    db.execute(delete(problem_list_items).where(
        problem_list_items.c.list_id == list_id, problem_list_items.c.problem_id == problem_id))
    db.commit()
    return Message(message="Removed")


@router.get("/lists/containing/{problem_id}", response_model=list[int],
            summary="Which of your lists contain a problem")
def lists_containing(problem_id: int, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)) -> list[int]:
    return list(db.scalars(
        select(problem_list_items.c.list_id)
        .join(ProblemList, ProblemList.id == problem_list_items.c.list_id)
        .where(ProblemList.user_id == user.id, problem_list_items.c.problem_id == problem_id)
    ))


def _ensure_default(db: Session, user: User) -> None:
    if db.scalar(select(ProblemList.id).where(ProblemList.user_id == user.id, ProblemList.name == DEFAULT_LIST)):
        return
    db.add(ProblemList(user_id=user.id, name=DEFAULT_LIST))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def _own_list(db: Session, list_id: int, user: User) -> ProblemList:
    problem_list = db.get(ProblemList, list_id)
    if problem_list is None or problem_list.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "List not found")
    return problem_list


# ============================================================= editorials
EDITORIAL_PROMPT = """\
You write editorials for a competitive-programming judge. Explain how to solve \
the problem below so a student who is stuck can understand it and write it \
themselves.

You are given a solution that has been verified to pass every test. Explain \
THAT approach; do not invent a different algorithm. Structure, in Markdown:

## Key idea
(the observation that cracks it, in plain words)
## Algorithm
(numbered steps)
## Complexity
(time and memory, in terms of the input sizes)
## Implementation
(a clean, commented Python version of the verified solution, in a ```python block)
## Pitfalls
(edge cases and common mistakes, as bullets)

Be concise and precise. Use $...$ for maths.
"""


@router.get("/problems/{identifier}/editorial", response_model=EditorialOut,
            summary="The problem's editorial (drafted by AI from a verified solution on first request)")
def get_editorial(identifier: str, db: Session = Depends(get_db),
                  viewer: User | None = Depends(get_optional_user)) -> EditorialOut:
    problem = _problem(db, identifier, viewer)
    _no_spoilers(db, problem)

    editorial = db.get(Editorial, problem.id)
    if editorial is None:
        editorial = _draft_editorial(db, problem, viewer)
    return EditorialOut(problem_id=problem.id, body=editorial.body, author=editorial.author,
                        created_at=editorial.created_at)


@router.put("/problems/{problem_id}/editorial", response_model=EditorialOut,
            summary="Write or replace an editorial (admin only)")
def put_editorial(problem_id: int, body: EditorialUpdate, db: Session = Depends(get_db),
                  admin: User = Depends(get_current_admin)) -> EditorialOut:
    problem = db.get(Problem, problem_id)
    if problem is None:
        raise _not_found()
    editorial = db.get(Editorial, problem.id) or Editorial(problem_id=problem.id, body="", author="staff")
    editorial.body, editorial.author, editorial.created_at = body.body, "staff", utcnow()
    db.merge(editorial)
    db.commit()
    return EditorialOut(problem_id=problem.id, body=body.body, author="staff", created_at=editorial.created_at)


def _draft_editorial(db: Session, problem: Problem, viewer: User | None) -> Editorial:
    if not problem.reference_solution:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No editorial for this problem yet")
    if viewer is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to open the editorial")
    if not coach_service.is_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Editorials are not set up on this server yet")
    # A first-time draft spends the shared free AI quota, so it counts as
    # one of the reader's daily coach replies. Cached editorials are free.
    if _used_today(db, viewer) >= settings.COACH_DAILY_LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "You have used today's AI replies; this editorial can be drafted tomorrow.")

    messages = [
        {"role": "system", "content": EDITORIAL_PROMPT + "\n\n" + coach_service._problem_brief(problem)},
        {"role": "user", "content": f"Verified solution ({problem.reference_language or 'python'}):\n"
                                    f"```\n{problem.reference_solution[:12000]}\n```"},
    ]
    try:
        body = coach_service.complete(messages)
    except coach_service.CoachUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    _record_reply(db, viewer)
    providers = coach_service.providers()
    editorial = Editorial(problem_id=problem.id, body=body,
                          author=f"AI draft ({providers[0].model})" if providers else "AI draft")
    db.add(editorial)
    try:
        db.commit()
    except IntegrityError:
        # Two readers asked at once; keep whichever was saved first.
        db.rollback()
        editorial = db.get(Editorial, problem.id)
    return editorial

