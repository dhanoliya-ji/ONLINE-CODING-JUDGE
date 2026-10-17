import { Link } from "react-router-dom";
import { Countdown } from "../problems/contest-bits";
import type { ContestMode } from "./useContestMode";

export function ContestBanner({ mode, onElapsed }: { mode: NonNullable<ContestMode>; onElapsed: () => void }) {
  const back = `/contests/${mode.contest.slug ?? mode.contest.id}`;
  const tone =
    mode.kind === "over" ? "border-line bg-surface-2 text-ink-2" : "border-ember/35 bg-ember/10 text-ink";
  return (
    <div className={`mx-2.5 mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2 text-sm ${tone}`} role="status">
      <span className="font-semibold">
        {mode.kind === "live" && "Contest mode"}
        {mode.kind === "virtual" && "Virtual replay"}
        {mode.kind === "over" && "This contest is over"}
      </span>
      <span className="text-ink-2">
        {mode.contest.title}
        {mode.kind === "over" && " · submissions here count as practice"}
      </span>
      {mode.kind !== "over" && (
        <span className="font-mono text-xs text-ink-2">
          ends in <Countdown target={mode.endsAt} onElapsed={onElapsed} />
        </span>
      )}
      <Link to={back} className="ml-auto text-xs font-semibold text-ember hover:underline">
        Back to the contest →
      </Link>
    </div>
  );
}
