"""How a program's output is compared with the expected answer.

Each problem names its checker. ``exact`` is the original behaviour; the
others exist because real problem sets need them:

* ``exact``            - line by line, ignoring trailing spaces and blank lines
* ``tokens``           - whitespace-separated tokens; line breaks do not matter
                         (Codeforces' usual checker)
* ``case_insensitive`` - tokens, ignoring letter case ("YES" == "yes")
* ``float:<eps>``      - tokens; numbers may differ by an absolute *or*
                         relative error of at most ``eps``, e.g. ``float:1e-6``
"""

from __future__ import annotations

import math
import re

CHECKERS = ("exact", "tokens", "case_insensitive", "float")

_FLOAT = re.compile(r"^float:(\d+(\.\d+)?([eE]-?\d+)?)$")


def is_valid_checker(name: str) -> bool:
    return name in ("exact", "tokens", "case_insensitive") or bool(_FLOAT.match(name))


def outputs_match(expected: str, actual: str, checker: str = "exact") -> bool:
    if checker == "exact":
        return _normalise_lines(expected) == _normalise_lines(actual)
    if checker == "tokens":
        return expected.split() == actual.split()
    if checker == "case_insensitive":
        return expected.casefold().split() == actual.casefold().split()
    match = _FLOAT.match(checker)
    if match:
        return _floats_match(expected.split(), actual.split(), float(match.group(1)))
    raise ValueError(f"Unknown checker {checker!r}")


def _normalise_lines(text: str) -> str:
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    trimmed = [line.rstrip() for line in lines]
    while trimmed and trimmed[-1] == "":
        trimmed.pop()
    return "\n".join(trimmed)


def _floats_match(expected: list[str], actual: list[str], eps: float) -> bool:
    if len(expected) != len(actual):
        return False
    for want, got in zip(expected, actual, strict=True):
        if want == got:
            continue
        try:
            a, b = float(want), float(got)
        except ValueError:
            return False
        if not (math.isfinite(a) and math.isfinite(b)):
            return False
        if abs(a - b) > eps * max(1.0, abs(a)):
            return False
    return True
