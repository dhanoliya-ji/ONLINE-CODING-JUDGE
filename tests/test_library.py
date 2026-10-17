"""The TACO importer's filters and statement parser (scripts/library/taco.py)."""

import json
import sys

import pytest

from scripts.library import taco

CODEFORCES = """Vasya has an array of $n$ integers. He wants to know the largest sum of any two
neighbouring elements, because that is what Vasya likes to know on a Tuesday.


-----Input-----

The first line contains $n$ ($2 \\le n \\le 10^5$). The second line contains the array.


-----Output-----

Print one integer: the largest sum.


-----Examples-----
Input
3
1 2 3

Output
5

Input
2
5 5

Output
10



-----Note-----

In the first example the answer is $2 + 3$.
"""

CODECHEF = """Read problems statements in [Hindi], [Bengali], [Mandarin Chinese], [Russian], and [Vietnamese] as well.

Chef has $N$ boxes, each holding some candies, and wants to know how many candies he holds in
total across every box he owns, so that he can share them with his friends.

------  Input ------
The first line contains $T$, the number of test cases. Each test case has $N$ and the counts.

------  Output ------
For each test case print the total.

------  Constraints ------
$1 ≤ T ≤ 100$

----- Sample Input 1 ------
1
3
1 2 3
----- Sample Output 1 ------
6
----- explanation 1 ------
Example case 1: $1 + 2 + 3 = 6$.
"""

OLD_CODEFORCES = """Little Tommy has a sequence of numbers and he would like to know the longest run of equal
values in it, because long runs make him happy for reasons nobody fully understands.

Input

The first line contains n (1 ≤ n ≤ 2000).

Output

Print a single integer.

Examples

Input

4
1 1 2 2


Output

2

Note

The runs are [1, 1] and [2, 2].
"""


def _row(question, source="codeforces", url="https://codeforces.com/problemset/problem/1/A",
         tests=6, **extra):
    inputs = [f"{k}\n{k} {k + 1}\n" for k in range(2, 2 + tests)]
    if source == "codeforces":
        inputs[0] = "3\n1 2 3\n"
    return {
        "question": question, "source": source, "url": url,
        "solutions": json.dumps(["print(1)", "x = input()\nprint(2)"]),
        "input_output": json.dumps({"inputs": inputs, "outputs": [str(k) for k in range(tests)]}),
        "difficulty": "EASY", "tags": "['Mathematics', 'Greedy algorithms']",
        "skill_types": "[]", "time_limit": "1 second", "memory_limit": "256 megabytes", **extra,
    }


def test_codeforces_statement_is_split_into_fields():
    candidate = taco.candidate_from_row(_row(CODEFORCES))
    assert candidate.external_id == "codeforces/1/A"
    assert candidate.description.startswith("Vasya has an array")
    assert "**Note**" in candidate.description and "$2 + 3$" in candidate.description
    assert candidate.input_format.startswith("The first line contains $n$")
    assert candidate.output_format == "Print one integer: the largest sum."
    assert candidate.time_limit_ms == 1000 and candidate.memory_limit_mb == 256
    assert candidate.tags == ["Math", "Greedy"]
    assert candidate.checker == "tokens"
    # The test whose input is the statement's first example is the sample.
    assert candidate.tests[0] == {"input": "3\n1 2 3\n", "output": "0", "sample": True}
    assert sum(t["sample"] for t in candidate.tests) == 1


def test_codechef_statement():
    candidate = taco.candidate_from_row(
        _row(CODECHEF, source="codechef", url="https://www.codechef.com/problems/CANDY1"))
    assert candidate.external_id == "codechef/CANDY1"
    assert "Read problems statements" not in candidate.description
    assert candidate.constraints == "$1 ≤ T ≤ 100$"
    assert "Example case 1" in candidate.description


def test_older_codeforces_text_is_kept_when_its_numbers_are_trustworthy():
    candidate = taco.candidate_from_row(_row(OLD_CODEFORCES))
    assert candidate.input_format == "The first line contains n (1 ≤ n ≤ 2000)."
    assert candidate.output_format == "Print a single integer."


def test_older_codeforces_text_with_a_flattened_exponent_is_skipped():
    # "≤ 105" was 10^5 before the exponent was flattened.
    with pytest.raises(taco.Skip, match="formatting"):
        taco.candidate_from_row(_row(OLD_CODEFORCES.replace("2000", "105")))


@pytest.mark.parametrize("phrase, reason", [
    ("If there are multiple answers, print any of them.", "several answers"),
    ("This is an interactive problem.", "interactive"),
    ("The picture below [Image] shows it.", "image"),
])
def test_unjudgeable_statements_are_skipped(phrase, reason):
    with pytest.raises(taco.Skip, match=reason):
        taco.candidate_from_row(_row(CODEFORCES.replace("Print one integer", phrase + " Print")))


@pytest.mark.parametrize("phrase, checker", [
    ("Your answer is accepted if its absolute or relative error does not exceed $10^{-9}$.", "float:1e-9"),
    ("The answer is correct if the absolute or relative error is small.", "float:1e-6"),
    ("You may print YES and NO in any case.", "case_insensitive"),
])
def test_checker_is_chosen_from_the_statement(phrase, checker):
    assert taco.choose_checker("Some text. " + phrase) == checker


def test_function_based_and_thin_problems_are_skipped():
    row = _row(CODEFORCES)
    row["input_output"] = json.dumps({"fn_name": "solve", "inputs": [[1]], "outputs": [1]})
    with pytest.raises(taco.Skip, match="function"):
        taco.candidate_from_row(row)
    with pytest.raises(taco.Skip, match="usable tests"):
        taco.candidate_from_row(_row(CODEFORCES, tests=3))


def test_unsupported_sources_are_skipped():
    with pytest.raises(taco.Skip, match="not imported"):
        taco.candidate_from_row(_row(CODEFORCES, source="leetcode"))


def test_atcoder_rows_without_a_url_are_matched_by_name():
    question = CODEFORCES  # any well-formed statement
    row = _row(question, source="atcoder", url=None, name="AtCoder Beginner Contest 176 - Bomber")
    candidate = taco.candidate_from_row(row, lambda name: ("abc176_e", "abc176"))
    assert candidate.external_id == "atcoder/abc176_e"
    assert candidate.source_url == "https://atcoder.jp/contests/abc176/tasks/abc176_e"


def test_list_form_tests_are_joined_into_lines():
    raw = json.dumps({"inputs": [["2", "1 2"]], "outputs": [["3"]]})
    assert taco.parse_tests(raw) == [("2\n1 2\n", "3\n")]


def test_test_selection_respects_the_budget():
    pairs = [(f"{k}\n" + "x" * (k * 1000), str(k)) for k in range(1, 60)]
    chosen = taco.select_tests(pairs, samples=[])
    assert len(chosen) <= taco.MAX_TESTS
    assert sum(len(t["input"]) + len(t["output"]) for t in chosen) <= taco.MAX_TOTAL_BYTES
    assert chosen[0]["sample"] and not any(t["sample"] for t in chosen[1:])


# ---------------------------------------------------------- verification --
def _candidate(solutions, outputs, checker="tokens", time_limit_ms=1000):
    tests = [{"input": f"{k} {k}\n", "output": out, "sample": k == 0}
             for k, out in enumerate(outputs)]
    return {"external_id": "codeforces/1/A", "source": "Codeforces", "title": "Double",
            "time_limit_ms": time_limit_ms, "memory_limit_mb": 256, "checker": checker,
            "solutions": solutions, "tests": tests, "sample_inputs": []}


SUM = "a, b = map(int, input().split())\nprint(a + b)\n"


@pytest.mark.skipif(sys.platform == "win32", reason="the local sandbox needs POSIX rlimits")
class TestVerify:
    def test_a_correct_solution_keeps_every_test(self):
        from scripts.library.verify import verify

        problem, reason = verify(_candidate(["print(0)", SUM], [str(2 * k) for k in range(6)]))
        assert reason == "verified"
        assert problem["reference_solution"] == SUM
        assert len(problem["tests"]) == 6 and "solutions" not in problem

    def test_a_faulty_test_is_dropped(self):
        from scripts.library.verify import verify

        outputs = [str(2 * k) for k in range(6)]
        outputs[4] = "999"  # a generated test that disagrees with every solution
        problem, reason = verify(_candidate([SUM], outputs))
        assert reason == "verified after dropping faulty tests"
        assert len(problem["tests"]) == 5

    def test_disagreement_drops_the_problem(self):
        from scripts.library.verify import verify

        problem, reason = verify(_candidate([SUM], ["0", "1", "1", "1", "1", "1"]))
        assert problem is None




ATCODER_PLAIN = """We have an integer sequence A, whose length is N, and we would like to count the
non-empty contiguous subsequences of A whose sums are exactly zero, counting positions.

Constraints

* 1 \leq N \leq 2 \times 10^5

Input

Input is given from Standard Input in the following format:

N
A_1 A_2 ... A_N

Output

Find the number of such subsequences.

Examples

Input

3
1 -1 0

Output

3
"""


def test_atcoder_plain_headings_with_constraints():
    row = _row(ATCODER_PLAIN, source="atcoder", url="https://atcoder.jp/contests/agc023/tasks/agc023_a")
    candidate = taco.candidate_from_row(row)
    assert candidate.constraints == "* 1 \leq N \leq 2 \times 10^5"
    assert candidate.input_format.startswith("Input is given")
    assert candidate.output_format == "Find the number of such subsequences."
    assert candidate.sample_inputs and candidate.sample_inputs[0].split() == ["3", "1", "-1", "0"]
