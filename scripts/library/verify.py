"""Step 2 of 3: keep only problems a known-correct solution actually solves.

    python -m scripts.library.verify --in candidates-0.jsonl.gz --out verified-0.jsonl.gz

Every candidate's reference solutions run against its tests in Crucible's
own sandbox (the local backend, so this needs Linux), with the problem's own
checker. A problem is kept when one solution passes all its tests; or, when
none does, when the best solution passes at least 80% of them including every
sample -- the tests it fails are dropped as faulty (TACO's generated tests
sometimes break the stated constraints). Fewer than five tests left: dropped.

The time limit is raised where needed so the reference solution, run as
Python with Crucible's 3x Python allowance, finishes with room to spare.
"""

from __future__ import annotations

import argparse
import collections
import gzip
import json
import logging
import math
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

os.environ.setdefault("DATABASE_URL", "sqlite:///./verify-unused.db")
os.environ.setdefault("SECRET_KEY", "library-verification")

from app.execution.base import ExecutionRequest, Outcome  # noqa: E402
from app.execution.checkers import outputs_match  # noqa: E402
from app.execution.local_backend import LocalBackend  # noqa: E402

logger = logging.getLogger("verify")

MIN_TESTS = 5
MIN_PASS_SHARE = 0.8
PYTHON_MULTIPLIER = 3  # keep in step with LANGUAGES["python"].time_multiplier
MAX_TIME_LIMIT_MS = 10_000
#: Each verification run gets this much, however slow the problem's limit.
RUN_LIMIT_MS = 15_000


def verify(candidate: dict) -> tuple[dict | None, str]:
    """(problem ready to load, or None; reason)."""
    backend = LocalBackend()
    tests = candidate["tests"]
    memory = max(candidate["memory_limit_mb"], 256)

    best: tuple[int, str, list[bool], float] | None = None
    for solution in candidate["solutions"]:
        passed, slowest = [], 0.0
        for test in tests:
            result = backend.run(ExecutionRequest(
                language="python", source_code=solution, stdin=test["input"],
                time_limit_ms=RUN_LIMIT_MS, memory_limit_mb=memory,
                max_output_bytes=1024 * 1024,
            ))
            ok = result.outcome is Outcome.OK and outputs_match(
                test["output"], result.stdout, candidate["checker"])
            passed.append(ok)
            if ok:
                slowest = max(slowest, result.duration_ms)
            elif test["sample"] or (len(passed) - sum(passed)) > len(tests) * (1 - MIN_PASS_SHARE):
                break  # this solution cannot qualify; try the next one
        score = sum(passed)
        if best is None or score > best[0]:
            best = (score, solution, passed + [False] * (len(tests) - len(passed)), slowest)
        if score == len(tests):
            break

    if best is None:
        return None, "no solution ran"
    score, solution, passed, slowest = best
    if not all(ok for ok, test in zip(passed, tests, strict=True) if test["sample"]):
        return None, "reference solution fails a sample"
    if score < len(tests) * MIN_PASS_SHARE:
        return None, "reference solutions disagree with the tests"
    kept = [test for ok, test in zip(passed, tests, strict=True) if ok]
    if len(kept) < MIN_TESTS:
        return None, "too few tests survive"

    # Python gets PYTHON_MULTIPLIER x the limit; leave it 2x headroom over
    # what the reference needed here, since the judge's CPU may be slower.
    needed = math.ceil(slowest * 2 / PYTHON_MULTIPLIER / 100) * 100
    time_limit = max(candidate["time_limit_ms"], needed)
    if time_limit > MAX_TIME_LIMIT_MS:
        return None, "reference solution too slow"

    problem = {key: value for key, value in candidate.items()
               if key not in ("solutions", "tests", "sample_inputs")}
    problem.update(tests=kept, time_limit_ms=time_limit, reference_solution=solution,
                   reference_language="python", reference_time_ms=round(slowest))
    reason = "verified" if score == len(tests) else "verified after dropping faulty tests"
    return problem, reason


def _verify_line(line: str) -> tuple[dict | None, str, str]:
    candidate = json.loads(line)
    try:
        problem, reason = verify(candidate)
    except Exception as exc:  # noqa: BLE001 - one bad problem must not stop the run
        problem, reason = None, f"error: {type(exc).__name__}"
    return problem, reason, candidate["external_id"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--in", dest="source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=os.cpu_count() or 2)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    with gzip.open(args.source, "rt", encoding="utf-8") as handle:
        lines = handle.readlines()

    reasons: collections.Counter = collections.Counter()
    kept = 0
    with gzip.open(args.out, "wt", encoding="utf-8") as out, \
            ProcessPoolExecutor(max_workers=args.workers) as pool:
        for done, (problem, reason, external_id) in enumerate(
                pool.map(_verify_line, lines, chunksize=4), start=1):
            reasons[reason] += 1
            if problem is not None:
                out.write(json.dumps(problem) + "\n")
                kept += 1
            if done % 50 == 0:
                logger.info("%d/%d checked, %d kept (last: %s, %s)", done, len(lines), kept,
                            external_id, reason)

    report = {"checked": len(lines), "kept": kept, "reasons": dict(reasons.most_common())}
    args.out.with_suffix("").with_suffix(".report.json").write_text(json.dumps(report, indent=2))
    logger.info("%s", report)


if __name__ == "__main__":
    main()
