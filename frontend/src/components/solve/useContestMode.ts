import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Contest } from "../../lib/types";

export type ContestMode =
  | { kind: "live" | "virtual"; contest: Contest; endsAt: string }
  | { kind: "over"; contest: Contest }
  | null;

/**
 * Opened from a contest (`/problems/:slug?contest=<id>`): is this a live
 * round, the user's virtual replay, or a contest that is already over?
 * Submissions go to the contest only in the first two cases.
 */
export function useContestMode(contestId: number | null, signedIn: boolean, version = 0): ContestMode {
  const [mode, setMode] = useState<ContestMode>(null);

  useEffect(() => {
    if (contestId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const contest = await api.contest(contestId);
        if (contest.state === "Running") {
          if (!cancelled) setMode({ kind: "live", contest, endsAt: contest.end_time });
          return;
        }
        if (contest.state === "Ended" && signedIn) {
          try {
            const replay = await api.virtualStatus(contestId);
            if (replay.active) {
              if (!cancelled) setMode({ kind: "virtual", contest, endsAt: replay.ends_at });
              return;
            }
          } catch {
            // No replay: fall through to "over".
          }
        }
        if (!cancelled) setMode({ kind: "over", contest });
      } catch {
        if (!cancelled) setMode(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contestId, signedIn, version]);

  return contestId == null ? null : mode;
}
