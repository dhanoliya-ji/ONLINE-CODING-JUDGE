"""Contest ratings, Codeforces-style.

For each participant:

1. **Seed**: the rank they were expected to finish, from everyone's current
   ratings: ``1 + Σ P(j beats i)`` with the Elo probability
   ``P = 1 / (1 + 10^((Ri − Rj) / 400))``.
2. **Performance**: the rating whose seed equals the geometric mean of the
   expected and actual ranks. The mean damps luck in a single round.
3. **Change**: half the gap between performance and current rating.

Then two corrections, as Codeforces does: changes are shifted so they sum to
slightly below zero (ratings must not inflate as more people play), and the
top-rated players' changes are capped so they can't drift upward together.

Newcomers enter at ``INITIAL_RATING``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

INITIAL_RATING = 1500


@dataclass(frozen=True)
class Standing:
    user_id: int
    #: 1-based place; tied players share the same value.
    rank: int
    rating: int


def _win_probability(ra: float, rb: float) -> float:
    """Probability that a player rated ``ra`` finishes above one rated ``rb``."""
    return 1.0 / (1.0 + math.pow(10.0, (rb - ra) / 400.0))


def _seed(rating: float, others: list[int]) -> float:
    return 1.0 + sum(_win_probability(other, rating) for other in others)


def _rating_for_seed(target: float, others: list[int]) -> float:
    """Binary search: the rating at which the expected rank equals ``target``."""
    low, high = -2000.0, 6000.0
    for _ in range(60):
        middle = (low + high) / 2
        # A higher rating means a better (smaller) expected rank.
        if _seed(middle, others) > target:
            low = middle
        else:
            high = middle
    return (low + high) / 2


def _shared_ranks(standings: list[Standing]) -> dict[int, float]:
    """Tied players get the average of the places they share (2 and 3 -> 2.5)."""
    ordered = sorted(standings, key=lambda s: s.rank)
    result: dict[int, float] = {}
    position = 1
    index = 0
    while index < len(ordered):
        group = [s for s in ordered[index:] if s.rank == ordered[index].rank]
        average = position + (len(group) - 1) / 2
        for standing in group:
            result[standing.user_id] = average
        position += len(group)
        index += len(group)
    return result


def rating_changes(standings: list[Standing]) -> dict[int, int]:
    """``{user_id: new_rating}`` after one contest."""
    if len(standings) < 2:
        # Nobody to be compared with: nothing to learn from this contest.
        return {s.user_id: s.rating for s in standings}

    places = _shared_ranks(standings)
    deltas: dict[int, float] = {}
    for me in standings:
        others = [s.rating for s in standings if s.user_id != me.user_id]
        expected = _seed(me.rating, others)
        target = math.sqrt(expected * places[me.user_id])
        performance = _rating_for_seed(target, others)
        deltas[me.user_id] = (performance - me.rating) / 2

    count = len(standings)
    # 1. Keep the total slightly negative so ratings do not inflate.
    shift = -sum(deltas.values()) / count - 1
    for user_id in deltas:
        deltas[user_id] += shift

    # 2. The strongest players should not all rise together.
    top = sorted(standings, key=lambda s: -s.rating)[: min(count, int(4 * math.sqrt(count)))]
    top_sum = sum(deltas[s.user_id] for s in top)
    cap = min(max(-top_sum / len(top), -10.0), 0.0)
    for user_id in deltas:
        deltas[user_id] += cap

    return {s.user_id: int(round(s.rating + deltas[s.user_id])) for s in standings}
