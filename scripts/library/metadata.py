"""Titles, ratings and tags from the source platforms' public APIs.

TACO has no titles for most problems and only coarse difficulty labels, so
the build enriches each candidate from free, unauthenticated APIs:

* Codeforces: one call returns every problem's name, rating and tags.
* AtCoder: the AtCoder Problems project (kenkoooo.com) publishes problem and
  contest lists, and estimated difficulties. TACO rows that lost their URL
  are matched back to a task by contest and problem name.
* CodeChef: one call per problem, throttled and cached on disk, so a re-run
  never repeats a request.
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

USER_AGENT = "crucible-problem-library (+https://github.com/dhanoliya-ji/ONLINE-CODING-JUDGE)"


def _get_json(url: str, timeout: float = 60):
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed https URLs
        return json.loads(response.read().decode("utf-8"))


class Metadata:
    def __init__(self, cache_dir: Path, offline: bool = False) -> None:
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.offline = offline
        self._codeforces: dict[str, dict] | None = None
        self._atcoder: dict[str, dict] | None = None
        self._atcoder_by_name: dict[tuple[str, str], str] | None = None
        self._codechef_path = cache_dir / "codechef.json"
        self._codechef: dict[str, dict] = (
            json.loads(self._codechef_path.read_text("utf-8")) if self._codechef_path.exists() else {}
        )
        self._last_codechef_call = 0.0

    # ---------------------------------------------------------- cached --
    def _cached(self, name: str, url: str):
        path = self.cache_dir / name
        if not path.exists():
            if self.offline:
                return None
            logger.info("Fetching %s", url)
            path.write_text(json.dumps(_get_json(url)), "utf-8")
        return json.loads(path.read_text("utf-8"))

    # ------------------------------------------------------ codeforces --
    def codeforces(self, contest_id: str, index: str) -> dict:
        if self._codeforces is None:
            data = self._cached("codeforces.json", "https://codeforces.com/api/problemset.problems")
            problems = (data or {}).get("result", {}).get("problems", [])
            self._codeforces = {f"{p['contestId']}/{p['index']}": p for p in problems if "contestId" in p}
        return self._codeforces.get(f"{contest_id}/{index}", {})

    # --------------------------------------------------------- atcoder --
    def _load_atcoder(self) -> None:
        problems = self._cached("atcoder_problems.json", "https://kenkoooo.com/atcoder/resources/problems.json") or []
        contests = self._cached("atcoder_contests.json", "https://kenkoooo.com/atcoder/resources/contests.json") or []
        models = self._cached("atcoder_models.json", "https://kenkoooo.com/atcoder/resources/problem-models.json") or {}
        titles = {c["id"]: c["title"] for c in contests}
        self._atcoder = {}
        self._atcoder_by_name = {}
        for problem in problems:
            entry = dict(problem, difficulty=(models.get(problem["id"]) or {}).get("difficulty"))
            self._atcoder[problem["id"]] = entry
            contest_title = titles.get(problem["contest_id"], "")
            self._atcoder_by_name[(_norm(contest_title), _norm(problem["name"]))] = problem["id"]

    def atcoder(self, task_id: str) -> dict:
        if self._atcoder is None:
            self._load_atcoder()
        return self._atcoder.get(task_id, {})

    def atcoder_task_for_name(self, taco_name: str) -> tuple[str, str] | None:
        """'AtCoder Beginner Contest 176 - Bomber' -> (task id, contest id)."""
        if self._atcoder is None:
            self._load_atcoder()
        contest, sep, problem = taco_name.rpartition(" - ")
        if not sep:
            return None
        task_id = self._atcoder_by_name.get((_norm(contest), _norm(problem)))
        if task_id is None:
            return None
        return task_id, self._atcoder[task_id]["contest_id"]

    # -------------------------------------------------------- codechef --
    def codechef(self, code: str) -> dict:
        if code in self._codechef or self.offline:
            return self._codechef.get(code, {})
        wait = 1.0 - (time.monotonic() - self._last_codechef_call)
        if wait > 0:
            time.sleep(wait)  # at most one request a second
        self._last_codechef_call = time.monotonic()
        try:
            data = _get_json(f"https://www.codechef.com/api/contests/PRACTICE/problems/{quote(code)}", 30)
            entry = {
                "name": data.get("problem_name"),
                "rating": _int(data.get("difficulty_rating")),
                "tags": _literal(data.get("computed_tags")) + _literal(data.get("user_tags")),
            }
        except Exception as exc:  # noqa: BLE001 - a missing title is not fatal
            logger.warning("CodeChef lookup failed for %s: %s", code, exc)
            entry = {}
        self._codechef[code] = entry
        self._codechef_path.write_text(json.dumps(self._codechef), "utf-8")
        return entry


def _norm(text: str) -> str:
    return " ".join(text.lower().replace("　", " ").split())


def _int(value) -> int | None:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _literal(value) -> list[str]:
    import ast

    if isinstance(value, list):
        return [str(v) for v in value]
    try:
        parsed = ast.literal_eval(value or "[]")
    except (ValueError, SyntaxError):
        return []
    return [str(v) for v in parsed] if isinstance(parsed, list) else []
