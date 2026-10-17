import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { DIFFICULTY_TEXT } from "../../lib/format";
import type { ProblemSummary } from "../../lib/types";
import { Skeleton } from "../ui";

/** Hours and minutes until the daily problem rolls over at UTC midnight. */
function untilRollover(): string {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const minutes = Math.max(0, Math.floor((next - now.getTime()) / 60_000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** "Problem of the day": the same pick for everyone, from api.dailyProblem(). */
export function DailyCard({ signedIn }: { signedIn: boolean }) {
  const [problem, setProblem] = useState<ProblemSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  // Refetch on sign-in so the solved tick reflects the viewer.
  useEffect(() => {
    let cancelled = false;
    api
      .dailyProblem()
      .then((found) => {
        if (cancelled) return;
        setProblem(found);
        setState("ready");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (state === "missing") return null;
  if (state === "loading" || !problem) return <Skeleton className="h-[132px] w-full rounded-[1.25rem]" />;

  const solved = Boolean(problem.solved_by_me);
  const meta = [
    ...problem.tags.slice(0, 3).map((tag) => tag.name),
    problem.source,
    problem.rating ? `${problem.rating}` : null,
  ].filter(Boolean);

  return (
    <Link
      to={`/problems/${problem.slug}`}
      className="tilt group relative isolate flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-[1.25rem] border border-ember/30 bg-gradient-to-br from-ember/12 via-surface to-surface px-6 py-6 sm:px-7"
      aria-label={`Problem of the day: ${problem.title}, ${problem.difficulty}${solved ? ", solved" : ""}`}
    >
      {/* Ember glow in the corner, as in the design. */}
      <span
        className="pointer-events-none absolute -top-24 -right-16 -z-10 size-64 rounded-full bg-ember/25 blur-3xl"
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-col gap-2">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-medium tracking-[0.16em] text-ember-2 uppercase">
          Problem of the day
          <span className="tracking-normal text-ink-3 normal-case">new in {untilRollover()}</span>
        </span>
        <span className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">{problem.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
          <span className={`font-semibold ${DIFFICULTY_TEXT[problem.difficulty]}`}>{problem.difficulty}</span>
          {meta.map((item) => (
            <span key={item} className="flex items-center gap-2">
              <span className="text-ink-3" aria-hidden="true">
                ·
              </span>
              {item}
            </span>
          ))}
        </span>
      </span>
      <span
        className={[
          "relative inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold",
          solved ? "border border-pass/40 bg-pass/12 text-pass" : "btn-primary",
        ].join(" ")}
        aria-hidden="true"
      >
        {solved ? "✓ Solved today" : "Solve today's problem"}
        {!solved && <span className="transition-transform group-hover:translate-x-0.5">→</span>}
      </span>
    </Link>
  );
}
