import { Link } from "react-router-dom";
import { DIFFICULTY_TEXT } from "../../lib/format";
import type { ProblemSummary } from "../../lib/types";
import { DifficultyBadge } from "../ui";

/* ---------------------------------------------------------------- Status */

export function StatusIcon({ problem }: { problem: ProblemSummary }) {
  if (problem.solved_by_me) {
    return (
      <span
        role="img"
        aria-label="Solved"
        title="Solved"
        className="grid size-6 place-items-center rounded-full bg-pass/15 text-[13px] font-bold text-pass ring-1 ring-pass/40"
      >
        ✓
      </span>
    );
  }
  if (problem.attempted_by_me) {
    return (
      <span
        role="img"
        aria-label="Attempted"
        title="Attempted, not solved yet"
        className="grid size-6 place-items-center rounded-full bg-warn/12 ring-1 ring-warn/40"
      >
        <span className="size-2 rounded-full bg-warn" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="Not attempted"
      title="Not attempted"
      className="block size-6 rounded-full border border-dashed border-line-strong"
    />
  );
}

/* ---------------------------------------------------------------- Pieces */

/** Chips, for the phone cards where there is room to wrap. */
function TagChips({ problem, max }: { problem: ProblemSummary; max: number }) {
  const extra = problem.tags.length - max;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {problem.tags.slice(0, max).map((tag) => (
        <span
          key={tag.slug}
          className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11.5px] whitespace-nowrap text-ink-2"
        >
          {tag.name}
        </span>
      ))}
      {extra > 0 && <span className="font-mono text-[11px] text-ink-3">+{extra}</span>}
    </span>
  );
}

/** One line of text for the table, as in the design, so rows keep one height. */
function TagLine({ problem, max = 3 }: { problem: ProblemSummary; max?: number }) {
  if (!problem.tags.length) return <span className="text-ink-3">—</span>;
  const extra = problem.tags.length - max;
  const all = problem.tags.map((tag) => tag.name).join(", ");
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2" title={all}>
      <span className="truncate">
        {problem.tags
          .slice(0, max)
          .map((tag) => tag.name)
          .join(" · ")}
      </span>
      {extra > 0 && (
        <span className="shrink-0 rounded-md bg-surface-3 px-1.5 font-mono text-[11px] text-ink-2">
          <span className="sr-only">and </span>+{extra}
          <span className="sr-only"> more</span>
        </span>
      )}
    </span>
  );
}

const acceptance = (problem: ProblemSummary) =>
  problem.acceptance_rate === null ? "—" : `${problem.acceptance_rate.toFixed(1)}%`;

/* ----------------------------------------------------------------- Table */

const TH = "px-4 py-3 font-mono text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase";

export function ProblemResults({
  problems,
  loading,
  signedIn,
}: {
  problems: ProblemSummary[];
  loading: boolean;
  signedIn: boolean;
}) {
  if (loading && problems.length === 0) return <ResultsSkeleton />;

  return (
    <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
      {/* Desktop and tablet: a real table. */}
      <div className="panel hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Problems</caption>
          <thead>
            <tr className="border-b border-line bg-surface-2/50 text-left">
              {signedIn && (
                <th scope="col" className={`${TH} w-14`}>
                  <span className="sr-only">Status</span>
                </th>
              )}
              <th scope="col" className={TH}>
                Title
              </th>
              <th scope="col" className={`${TH} hidden lg:table-cell`}>
                Topics
              </th>
              <th scope="col" className={TH}>
                Difficulty
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Rating
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Accept.
              </th>
              <th scope="col" className={`${TH} hidden xl:table-cell`}>
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {problems.map((problem) => (
              <tr
                key={problem.id}
                className="group border-b border-line transition-colors last:border-0 hover:bg-surface-2/70"
              >
                {signedIn && (
                  <td className="px-4 py-3.5">
                    <StatusIcon problem={problem} />
                  </td>
                )}
                <td className="max-w-0 px-4 py-3.5 lg:w-[34%] xl:w-[32%]">
                  <Link
                    to={`/problems/${problem.slug}`}
                    className="flex min-w-0 items-baseline gap-2 font-medium text-ink transition-colors group-hover:text-ember-2 hover:text-ember"
                  >
                    <span className="shrink-0 font-mono text-xs text-ink-3 tabular-nums">{problem.id}.</span>
                    <span className="truncate">{problem.title}</span>
                  </Link>
                </td>
                <td className="hidden max-w-0 px-4 py-3.5 lg:table-cell lg:w-[28%]">
                  <TagLine problem={problem} />
                </td>
                <td className="px-4 py-3.5">
                  <DifficultyBadge difficulty={problem.difficulty} />
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-ink-2 tabular-nums">
                  {problem.rating ?? <span className="text-ink-3">—</span>}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-ink-2 tabular-nums">{acceptance(problem)}</td>
                <td className="hidden px-4 py-3.5 text-ink-2 xl:table-cell">
                  {problem.source ?? <span className="text-ink-3">Crucible</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: each row becomes a compact card. */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {problems.map((problem) => (
          <li key={problem.id}>
            <Link
              to={`/problems/${problem.slug}`}
              className="panel flex gap-3 p-4 transition-colors hover:border-line-strong active:bg-surface-2"
            >
              {signedIn && (
                <span className="pt-0.5">
                  <StatusIcon problem={problem} />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-xs text-ink-3">{problem.id}.</span>
                  <span className="font-medium text-ink">{problem.title}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-3">
                  <span className={`font-sans font-semibold ${DIFFICULTY_TEXT[problem.difficulty]}`}>
                    {problem.difficulty}
                  </span>
                  {problem.rating !== null && <span>★ {problem.rating}</span>}
                  {problem.acceptance_rate !== null && <span>{acceptance(problem)} acc.</span>}
                  {problem.source && <span>{problem.source}</span>}
                </span>
                {problem.tags.length > 0 && <TagChips problem={problem} max={3} />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="panel hidden overflow-hidden md:block">
        <div className="h-11 border-b border-line bg-surface-2/50" />
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex items-center gap-6 border-b border-line px-4 py-4 last:border-0">
            <span className="skeleton size-6 rounded-full" />
            <span className="skeleton h-4 flex-1" style={{ maxWidth: `${30 + ((index * 37) % 30)}%` }} />
            <span className="skeleton hidden h-4 w-40 lg:block" />
            <span className="skeleton h-5 w-16 rounded-full" />
            <span className="skeleton h-4 w-10" />
            <span className="skeleton h-4 w-12" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5 md:hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className="skeleton block h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
