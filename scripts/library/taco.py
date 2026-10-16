"""Turn one TACO dataset row into a Crucible problem candidate.

TACO (https://huggingface.co/datasets/BAAI/TACO, Apache-2.0) collects about
26,000 problems with tests and Python solutions. Only part of it suits a
stdin/stdout judge, so every row passes through filters here:

* Sources: Codeforces, CodeChef and AtCoder. GeeksforGeeks, LeetCode and
  Codewars test functions, not programs; Kattis has no solutions to verify
  against; Aizu's statements are rough machine translations; HackerRank's
  licence is unknown.
* Statements that reference images, need an interactive or special judge
  ("print any of them"), or lost their formatting are skipped.
* What survives still has to pass verification (verify.py): a known-correct
  solution must produce the expected output under Crucible's own judge.

Nothing here touches the network or a database, so it is unit-tested
directly (tests/test_library.py).
"""

from __future__ import annotations

import ast
import json
import re
from dataclasses import dataclass, field
from typing import Callable

SOURCES = {"codeforces": "Codeforces", "codechef": "CodeChef", "atcoder": "AtCoder"}
LICENSE = "TACO dataset (BAAI), Apache-2.0"

MAX_TESTS = 12
MAX_TEST_BYTES = 48 * 1024  # one input or output
MAX_TOTAL_BYTES = 128 * 1024  # all kept tests together
MIN_TESTS = 5
MAX_SOLUTIONS = 4


class Skip(Exception):
    """This row cannot become a problem; the message says why."""


@dataclass
class Candidate:
    external_id: str
    source: str
    source_url: str
    title: str
    difficulty: str
    description: str
    input_format: str
    output_format: str
    constraints: str
    time_limit_ms: int
    memory_limit_mb: int
    checker: str
    tags: list[str]
    tests: list[dict]  # {"input", "output", "sample"}
    solutions: list[str]
    rating: int | None = None
    sample_inputs: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return self.__dict__.copy()


# ------------------------------------------------------------- filters ---
_IMAGE = re.compile(r"\[image\]|<image>|!\[", re.IGNORECASE)
_MULTIPLE_ANSWERS = re.compile(
    r"any of them|print any|output any|any (valid|possible|correct|such|suitable|optimal) "
    r"|any one of|if there are (several|multiple|many)|multiple (possible |valid |correct )?"
    r"(answers|solutions)|more than one (answer|solution)|any order",
    re.IGNORECASE,
)
_INTERACTIVE = re.compile(r"interactive|flush the output|fflush|stdout\.flush", re.IGNORECASE)
_FLOAT = re.compile(r"(absolute|relative) (or (absolute|relative) )?error", re.IGNORECASE)
_EPSILON = re.compile(r"10\s*\^\s*\{?\s*-\s*(\d+)\s*\}?|1e-(\d+)|10\s*-\s*(\d+)\b")
_ANY_CASE = re.compile(
    r"in any (letter )?case|any letter case|case[- ]insensitive|(upper|lower)\s*case or "
    r"(upper|lower)\s*case|(uppercase|lowercase) (or|and) (uppercase|lowercase)",
    re.IGNORECASE,
)


def choose_checker(text: str) -> str:
    if _FLOAT.search(text):
        found = _EPSILON.search(text[_FLOAT.search(text).start() :])
        digits = next((g for g in found.groups() if g), None) if found else None
        exponent = int(digits) if digits and 1 <= int(digits) <= 12 else 6
        return f"float:1e-{exponent}"
    if _ANY_CASE.search(text):
        return "case_insensitive"
    return "tokens"


def check_statement(text: str) -> None:
    if _IMAGE.search(text):
        raise Skip("statement references an image")
    if _INTERACTIVE.search(text):
        raise Skip("interactive problem")
    if _MULTIPLE_ANSWERS.search(text):
        raise Skip("accepts several answers (needs a special judge)")
    if len(text) < 150:
        raise Skip("statement too short")


# ------------------------------------------------------------ sections ---
_DASHED = re.compile(r"^\s*-{2,}\s*([A-Za-z][A-Za-z0-9 ():]*?)\s*:?\s*-{2,}\s*$", re.MULTILINE)
_HEADINGS = {
    "input": "input", "input format": "input",
    "output": "output", "output format": "output",
    "constraints": "constraints", "subtasks": "subtasks",
    "examples": "examples", "example": "examples",
    "sample input": "sample_in", "example input": "sample_in",
    "sample output": "sample_out", "example output": "sample_out",
    "note": "note", "notes": "note", "explanation": "note",
}


def _kind(heading: str) -> str | None:
    name = re.sub(r"[\d:()]", " ", heading).strip().lower()
    name = re.sub(r"\s+", " ", name)
    return _HEADINGS.get(name)


_PLAIN = re.compile(r"^[ \t]*(Input|Output|Examples?|Note|Constraints)[ \t]*$", re.MULTILINE)
#: In the older Codeforces text a constraint like 10^6 was flattened to 106.
#: A bound written as "≤ 10" followed by digits cannot be trusted.
_FLATTENED = re.compile(r"(≤|≥|<|>|\bto\b)\s*-?\s*\d*\s*·?\s*10\d{1,2}\b")


def dash_plain_headings(question: str) -> str:
    """Rewrite plain headings ("Input" alone on a line) as dashed ones.

    Used for the older Codeforces text and the AtCoder rows from the same
    crawl. Headings are taken in order -- Input, Output, Examples, Note --
    plus one Constraints anywhere before Examples, so the "Input"/"Output"
    lines inside the examples block stay as they are, as in the newer text.
    """
    order = ["Input", "Output", "Example", "Note"]
    stage, constraints_seen = 0, False
    pieces, position = [], 0
    for match in _PLAIN.finditer(question):
        name = match.group(1)
        kind = "Example" if name.startswith("Example") else name
        if kind == "Constraints":
            take = not constraints_seen and stage < 3
            constraints_seen = constraints_seen or take
        else:
            take = stage < len(order) and kind == order[stage]
            stage += take
        if take:
            pieces.append(question[position : match.start()])
            pieces.append(f"-----{name}-----")
            position = match.end()
    pieces.append(question[position:])
    return "".join(pieces)


def split_sections(question: str) -> dict[str, list[str]]:
    """``{"statement": [...], "input": [...], ...}`` from dashed headings.

    Each kind maps to a list because CodeChef repeats "Sample Input 1",
    "Sample Input 2", and AtCoder has several sample blocks.
    """
    text = question.replace("\r\n", "\n")
    headings = [(m.start(), m.end(), _kind(m.group(1))) for m in _DASHED.finditer(text)]
    if not any(kind in ("input", "output") for _, _, kind in headings):
        raise Skip("no recognisable Input/Output sections")

    sections: dict[str, list[str]] = {"statement": [text[: headings[0][0]].strip()]}
    seen_constraints = False
    for index, (_, end, kind) in enumerate(headings):
        body_end = headings[index + 1][0] if index + 1 < len(headings) else len(text)
        body = text[end:body_end].strip()
        if kind is None:
            # An unknown heading: keep its text with the statement.
            sections["statement"].append(body)
            continue
        if kind == "constraints":
            # AtCoder rows sometimes label Output as a second "Constraints".
            if seen_constraints and "output" not in sections:
                kind = "output"
            seen_constraints = True
        sections.setdefault(kind, []).append(body)
    return sections


_READ_IN = re.compile(r"^Read problems? statements? in .*$", re.MULTILINE | re.IGNORECASE)


def _clean(text: str) -> str:
    text = _READ_IN.sub("", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def build_text(sections: dict[str, list[str]]) -> tuple[str, str, str, str]:
    """(description, input_format, output_format, constraints)."""
    statement = _clean("\n\n".join(s for s in sections["statement"] if s))
    notes = [_clean(n) for n in sections.get("note", []) if n.strip()]
    if notes:
        statement += "\n\n**Note**\n\n" + "\n\n".join(notes)
    input_format = _clean("\n\n".join(sections.get("input", [])))
    output_format = _clean("\n\n".join(sections.get("output", [])))
    constraints = _clean("\n\n".join(sections.get("constraints", []) + sections.get("subtasks", [])))
    if len(statement) < 40 or not input_format or not output_format:
        raise Skip("statement, input or output section is empty")
    return statement, input_format, output_format, constraints


def example_inputs(sections: dict[str, list[str]]) -> list[str]:
    """Inputs of the worked examples, to mark matching tests as samples."""
    found = list(sections.get("sample_in", []))
    for block in sections.get("examples", []):
        # Codeforces: "Input\n...\n\nOutput\n...\n\nInput\n..."
        for match in re.finditer(r"(?:^|\n)Input\n(.*?)\n\s*Output\n", block + "\n", re.DOTALL):
            found.append(match.group(1))
    return found


def _tokens(text: str) -> list[str]:
    return text.split()


# --------------------------------------------------------------- tests ---
def parse_tests(raw: str | None) -> list[tuple[str, str]]:
    try:
        data = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise Skip("input_output is not valid JSON") from exc
    if "fn_name" in data:
        raise Skip("function-based tests, not stdin/stdout")
    inputs, outputs = data.get("inputs") or [], data.get("outputs") or []
    if not inputs or len(inputs) != len(outputs):
        raise Skip("no tests")

    def as_text(value) -> str:
        # CodeChef rows sometimes store a test as a list of lines.
        if isinstance(value, list):
            return "\n".join(str(line) for line in value) + "\n"
        return str(value)

    pairs, seen = [], set()
    for given, expected in zip(inputs, outputs, strict=True):
        given, expected = as_text(given), as_text(expected)
        if not given.endswith("\n"):
            given += "\n"
        if given in seen or not expected.strip():
            continue
        seen.add(given)
        pairs.append((given, expected))
    return pairs


def select_tests(pairs: list[tuple[str, str]], samples: list[str]) -> list[dict]:
    """At most MAX_TESTS tests within the size budget, samples first.

    Beyond the samples, tests are taken evenly across the size range, so the
    kept set still includes some of the larger (performance) cases.
    """
    small = [(i, o) for i, o in pairs if len(i) <= MAX_TEST_BYTES and len(o) <= MAX_TEST_BYTES]
    sample_keys = {" ".join(_tokens(s)) for s in samples}
    chosen = [p for p in small if " ".join(_tokens(p[0])) in sample_keys][:2]
    rest = sorted((p for p in small if p not in chosen), key=lambda p: len(p[0]) + len(p[1]))
    if not chosen and rest:
        chosen.append(rest.pop(0))  # the smallest test stands in as the sample
    sample_count = len(chosen)

    budget = MAX_TOTAL_BYTES - sum(len(i) + len(o) for i, o in chosen)
    slots = MAX_TESTS - len(chosen)
    if rest and slots > 0:
        step = max(1, len(rest) / slots)
        picks = sorted({min(len(rest) - 1, int(k * step)) for k in range(slots)})
        for index in picks:
            given, expected = rest[index]
            if len(given) + len(expected) <= budget:
                chosen.append((given, expected))
                budget -= len(given) + len(expected)

    if len(chosen) < MIN_TESTS:
        raise Skip(f"only {len(chosen)} usable tests")
    return [
        {"input": given, "output": expected, "sample": index < sample_count}
        for index, (given, expected) in enumerate(chosen)
    ]


# ------------------------------------------------------- limits & tags ---
def parse_time_limit(raw: str | None) -> int:
    match = re.search(r"(\d+(?:\.\d+)?)\s*sec", raw or "")
    seconds = float(match.group(1)) if match else 2.0
    return int(min(max(seconds, 1.0), 5.0) * 1000)


def parse_memory_limit(raw: str | None) -> int:
    match = re.search(r"(\d+(?:\.\d+)?)\s*megabytes", raw or "")
    megabytes = float(match.group(1)) if match else 256.0
    # Capped at 256 MB: the free host has 512 MB for everything.
    return int(min(max(megabytes, 64.0), 256.0))


DIFFICULTY = {"EASY": "Easy", "MEDIUM": "Medium", "MEDIUM_HARD": "Medium",
              "HARD": "Hard", "VERY_HARD": "Hard"}


def difficulty_for_rating(rating: int) -> str:
    return "Easy" if rating < 1300 else "Medium" if rating < 2000 else "Hard"


TAG_NAMES = {
    # TACO's canonical tags
    "mathematics": "Math", "data structures": "Data Structures",
    "implementation": "Implementation", "greedy algorithms": "Greedy",
    "dynamic programming": "Dynamic Programming", "sorting": "Sorting",
    "string algorithms": "Strings", "complete search": "Brute Force",
    "constructive algorithms": "Constructive", "fundamentals": "Basics",
    "graph algorithms": "Graphs", "number theory": "Number Theory",
    "graph traversal": "Graphs", "tree algorithms": "Trees",
    "bit manipulation": "Bit Manipulation", "ad-hoc": "Ad Hoc",
    "combinatorics": "Combinatorics", "geometry": "Geometry", "matrices": "Matrices",
    "game theory": "Game Theory", "spanning trees": "Spanning Trees",
    "probability": "Probability", "divide and conquer": "Divide and Conquer",
    "range queries": "Range Queries", "shortest paths": "Shortest Paths",
    "flows and cuts": "Flows", "polynomials and generating functions": "Math",
    "segment trees revisited": "Segment Tree", "strong connectivity": "Graphs",
    "square root algorithms": "Sqrt Decomposition", "tree queries": "Trees",
    "sweep line algorithms": "Sweep Line", "directed graphs": "Graphs",
    "paths and circuits": "Graphs",
    # Codeforces' own tags
    "dp": "Dynamic Programming", "greedy": "Greedy", "math": "Math",
    "brute force": "Brute Force", "sortings": "Sorting", "binary search": "Binary Search",
    "two pointers": "Two Pointers", "strings": "Strings", "graphs": "Graphs",
    "trees": "Trees", "dfs and similar": "Graphs", "bitmasks": "Bit Manipulation",
    "dsu": "Union Find", "hashing": "Hashing", "games": "Game Theory",
    "probabilities": "Probability", "fft": "FFT", "flows": "Flows",
    "graph matchings": "Matching", "string suffix structures": "Strings",
    "ternary search": "Binary Search", "meet-in-the-middle": "Meet in the Middle",
    "expression parsing": "Parsing", "2-sat": "Graphs",
    "chinese remainder theorem": "Number Theory", "schedules": "Greedy",
}


def tag_names(*groups: list[str]) -> list[str]:
    names: list[str] = []
    for group in groups:
        for raw in group:
            name = TAG_NAMES.get(raw.strip().lower())
            if name and name not in names:
                names.append(name)
    return names[:6]


def literal_list(raw: str | None) -> list[str]:
    try:
        value = ast.literal_eval(raw or "[]")
    except (ValueError, SyntaxError):
        return []
    return [str(v) for v in value] if isinstance(value, list) else []


# ------------------------------------------------------------ identity ---
_CF_URL = re.compile(r"codeforces\.com/(?:problemset/problem|contest)/(\d+)/(?:problem/)?([A-Z]\d?)")
_CC_URL = re.compile(r"codechef\.com/(?:[A-Z0-9]+/)?problems/([A-Z0-9_]+)")
_AC_URL = re.compile(r"atcoder\.jp/contests/([\w-]+)/tasks/([\w-]+)")


def identity(source: str, url: str | None) -> tuple[str, str]:
    """(external_id, canonical url) for a row, or Skip."""
    url = (url or "").strip()
    if source == "codeforces" and (m := _CF_URL.search(url)):
        return f"codeforces/{m.group(1)}/{m.group(2)}", f"https://codeforces.com/problemset/problem/{m.group(1)}/{m.group(2)}"
    if source == "codechef" and (m := _CC_URL.search(url)):
        return f"codechef/{m.group(1)}", f"https://www.codechef.com/problems/{m.group(1)}"
    if source == "atcoder" and (m := _AC_URL.search(url)):
        return f"atcoder/{m.group(2)}", f"https://atcoder.jp/contests/{m.group(1)}/tasks/{m.group(2)}"
    raise Skip("no usable source URL")


# ---------------------------------------------------------------- main ---
AtCoderResolver = Callable[[str], "tuple[str, str] | None"]


def candidate_from_row(row: dict, resolve_atcoder: AtCoderResolver | None = None) -> Candidate:
    source = row.get("source")
    if source not in SOURCES:
        raise Skip(f"source {source!r} is not imported")
    url = row.get("url")
    if source == "atcoder" and not url and resolve_atcoder and row.get("name"):
        # About half of TACO's AtCoder rows lost their URL but kept the title.
        found = resolve_atcoder(row["name"])
        if found:
            url = f"https://atcoder.jp/contests/{found[1]}/tasks/{found[0]}"
    external_id, url = identity(source, url)

    question = row.get("question") or ""
    if source in ("codeforces", "atcoder") and not _DASHED.search(question):
        # The older (CodeContests) crawl uses plain headings. Its Codeforces
        # text also flattened exponents, so "10^6" may read "106": keep it
        # only when no bound looks like that. (Its AtCoder text kept LaTeX.)
        if source == "codeforces" and _FLATTENED.search(question):
            raise Skip("statement lost its formatting")
        question = dash_plain_headings(question)
    check_statement(question)
    sections = split_sections(question)
    description, input_format, output_format, constraints = build_text(sections)

    try:
        solutions = [s for s in json.loads(row.get("solutions") or "[]") if isinstance(s, str)]
    except json.JSONDecodeError as exc:
        raise Skip("solutions are not valid JSON") from exc
    solutions = sorted((s for s in solutions if 0 < len(s) < 20_000), key=len)[:MAX_SOLUTIONS]
    if not solutions:
        raise Skip("no reference solution to verify against")

    samples = example_inputs(sections)
    tests = select_tests(parse_tests(row.get("input_output")), samples)

    difficulty = DIFFICULTY.get(row.get("difficulty") or "", "Medium")
    return Candidate(
        external_id=external_id,
        source=SOURCES[source],
        source_url=url,
        title=(row.get("name") or "").strip(),
        difficulty=difficulty,
        description=description,
        input_format=input_format,
        output_format=output_format,
        constraints=constraints,
        time_limit_ms=parse_time_limit(row.get("time_limit")),
        memory_limit_mb=parse_memory_limit(row.get("memory_limit")),
        checker=choose_checker(question),
        tags=tag_names(literal_list(row.get("tags")), literal_list(row.get("skill_types"))),
        tests=tests,
        solutions=solutions,
        sample_inputs=samples,
    )
