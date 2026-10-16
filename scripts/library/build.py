"""Step 1 of 3: TACO parquet files -> candidate problems, in shards.

    python -m scripts.library.build --taco DIR --out DIR [--shards 8]

Reads every parquet file in DIR, keeps the rows that can become problems
(see taco.py), adds titles, ratings and tags from the platforms' APIs (see
metadata.py), and writes ``candidates-<k>.jsonl.gz`` shards plus a
``build-report.json`` of what was skipped and why.
"""

from __future__ import annotations

import argparse
import collections
import gzip
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.library import taco  # noqa: E402
from scripts.library.metadata import Metadata  # noqa: E402

logger = logging.getLogger("build")

COLUMNS = ["question", "solutions", "input_output", "difficulty", "tags", "skill_types",
           "name", "source", "url", "time_limit", "memory_limit"]


def atcoder_rating(difficulty: float | None) -> int | None:
    """AtCoder Problems' difficulty, moved onto the Codeforces scale.

    Roughly: AtCoder ratings run about 400 below Codeforces ones for the
    same skill. Clipped to Codeforces' 800-3500 range.
    """
    if difficulty is None:
        return None
    return int(min(3500, max(800, round((difficulty + 400) / 100) * 100)))


def enrich(candidate: taco.Candidate, meta: Metadata) -> None:
    kind, *key = candidate.external_id.split("/")
    extra_tags: list[str] = []
    if kind == "codeforces":
        found = meta.codeforces(*key)
        candidate.title = found.get("name") or f"Codeforces {key[0]}{key[1]}"
        candidate.rating = found.get("rating")
        extra_tags = found.get("tags", [])
    elif kind == "atcoder":
        found = meta.atcoder(key[0])
        name = candidate.title.rpartition(" - ")[2] if candidate.title else ""
        candidate.title = found.get("name") or name or key[0]
        candidate.rating = atcoder_rating(found.get("difficulty"))
    elif kind == "codechef":
        found = meta.codechef(key[0])
        candidate.title = found.get("name") or key[0]
        candidate.rating = found.get("rating")
        extra_tags = found.get("tags", [])

    candidate.title = " ".join(candidate.title.split())[:200]
    if candidate.rating:
        candidate.difficulty = taco.difficulty_for_rating(candidate.rating)
    candidate.tags = taco.tag_names(extra_tags, candidate.tags) or candidate.tags


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--taco", type=Path, required=True, help="directory of TACO parquet files")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--shards", type=int, default=8)
    parser.add_argument("--cache", type=Path, default=Path(".library-cache"))
    parser.add_argument("--offline", action="store_true", help="use only cached metadata")
    parser.add_argument("--limit", type=int, default=0, help="stop after N candidates (testing)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    import pyarrow.parquet as pq  # only this step needs it

    meta = Metadata(args.cache, offline=args.offline)
    skipped: collections.Counter = collections.Counter()
    kept: dict[str, taco.Candidate] = {}

    for path in sorted(args.taco.glob("*.parquet")):
        logger.info("Reading %s", path.name)
        for batch in pq.ParquetFile(path).iter_batches(batch_size=256, columns=COLUMNS):
            for row in batch.to_pylist():
                if row.get("source") not in taco.SOURCES:
                    continue
                try:
                    candidate = taco.candidate_from_row(row, meta.atcoder_task_for_name)
                except taco.Skip as reason:
                    skipped[f"{row['source']}: {reason}"] += 1
                    continue
                if candidate.external_id in kept:
                    skipped[f"{row['source']}: duplicate"] += 1
                    continue
                enrich(candidate, meta)
                kept[candidate.external_id] = candidate
                if args.limit and len(kept) >= args.limit:
                    break
            if args.limit and len(kept) >= args.limit:
                break

    args.out.mkdir(parents=True, exist_ok=True)
    candidates = sorted(kept.values(), key=lambda c: c.external_id)
    shards = [gzip.open(args.out / f"candidates-{k}.jsonl.gz", "wt", encoding="utf-8")
              for k in range(args.shards)]
    for index, candidate in enumerate(candidates):
        shards[index % args.shards].write(json.dumps(candidate.to_json()) + "\n")
    for shard in shards:
        shard.close()

    by_source = collections.Counter(c.source for c in candidates)
    report = {"candidates": len(candidates), "by_source": by_source,
              "skipped": dict(skipped.most_common())}
    (args.out / "build-report.json").write_text(json.dumps(report, indent=2), "utf-8")
    logger.info("%d candidates %s; %d rows skipped", len(candidates), dict(by_source),
                sum(skipped.values()))


if __name__ == "__main__":
    main()
