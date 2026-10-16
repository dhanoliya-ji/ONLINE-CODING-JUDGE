# Problem library

Crucible's practice problems are imported from the
[TACO dataset](https://huggingface.co/datasets/BAAI/TACO) (BAAI, Shandong
Normal University and Peking University; Apache-2.0). Every imported problem
shows where it came from and links back to the original on Codeforces,
CodeChef or AtCoder.

## What gets imported, and what does not

TACO collects about 26,000 problems, but only part of it suits a judge that
reads standard input and compares standard output.

| Kept | Skipped, and why |
|---|---|
| Codeforces, CodeChef, AtCoder | GeeksforGeeks, LeetCode, Codewars: their tests call a function rather than run a program |
| | Kattis: no reference solutions to verify against |
| | Aizu: machine-translated statements |
| | HackerRank: licence unknown |

Within those sources, a problem is also skipped when its statement:

- references an image the text cannot show;
- accepts several correct answers ("print any of them"), which needs a
  problem-specific checker program;
- is interactive;
- comes from the older Codeforces text in which exponents were flattened, so
  that `10^6` reads `106`. Such text is kept only when no bound looks like
  that.

A problem also needs at least five usable tests.

## Verification

A problem is published only after a known-correct solution passes its tests
**in Crucible's own sandbox, with the problem's own checker**:

- If one reference solution passes every test, the problem is kept as is.
- If none does, the best one must pass at least 80% of the tests, including
  every sample. The tests it fails are dropped as faulty: TACO's generated
  tests sometimes break the stated constraints.
- If fewer than five tests survive, the problem is dropped.

The time limit is raised where needed, so the reference solution, run as
Python with the usual 3× Python allowance, finishes in half the time it gets.

## Checkers

The checker is chosen from the statement:

| Statement says | Checker |
|---|---|
| "absolute or relative error … 10⁻⁹" | `float:1e-9` |
| "in any case" (YES / yes) | `case_insensitive` |
| anything else | `tokens`: whitespace-separated tokens, layout ignored |

Problems written in Crucible itself default to `exact`.

## Running it

The **Problem library** workflow (Actions tab → *Run workflow*) runs the
whole pipeline:

1. **Filter and enrich** (`scripts/library/build.py`). Downloads TACO at a
   pinned commit and adds titles, ratings and tags from the Codeforces API,
   the AtCoder Problems project and the CodeChef API.
2. **Verify** (`scripts/library/verify.py`). Eight parallel shards.
3. **Publish**. The verified library becomes the `library.jsonl.gz` asset of
   the `problem-library` release, with a summary of the run.
4. **Load** (`scripts/library/load.py`). Only if *load* is ticked. Writes
   into the database named by the `DATABASE_URL` repository secret.

Loading matches problems on their source identity (e.g.
`codeforces/1288/C`), so running it again updates problems in place and keeps
their submissions.

To run the steps by hand (verification needs Linux):

```bash
pip install -r requirements.txt pyarrow
python -m scripts.library.build --taco path/to/taco --out out
python -m scripts.library.verify --in out/candidates-0.jsonl.gz --out verified-0.jsonl.gz
DATABASE_URL=... python -m scripts.library.load verified-*.jsonl.gz --dry-run
```

## Storage

Kept tests are capped at 12 per problem and 128 KB in total, so the whole
library fits comfortably in a free Neon database (0.5 GB). The reference
solution is stored with each problem for future editorials and the coach. It
is never sent to students.
