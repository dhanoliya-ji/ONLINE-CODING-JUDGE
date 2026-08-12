import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { ProblemSummary } from "../lib/types";
import {
  Alert,
  Card,
  DifficultyBadge,
  EmptyState,
  PageHeading,
  Skeleton,
} from "../components/ui";

const DIFFICULTIES = ["All", "Easy", "Medium", "Hard"] as const;
const PAGE_SIZE = 20;

export function Problems() {
  const { user } = useAuth();
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search so typing does not fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .problems({
          search: search || undefined,
          difficulty: difficulty === "All" ? undefined : difficulty,
          limit: PAGE_SIZE,
          offset,
        })
        .then((page) => {
          setProblems(page.items);
          setTotal(page.total);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, search ? 300 : 0);

    return () => clearTimeout(handle);
  }, [search, difficulty, offset]);

  const solvedCount = problems.filter((p) => p.solved_by_me).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeading
        eyebrow="Practice"
        title="Problems"
        description="Pick a problem, write a solution, and get a verdict against the full test suite in one request."
        actions={
          user && (
            <Card className="px-5 py-3">
              <p className="font-mono text-lg font-bold tabular-nums text-violet-50">
                {solvedCount}
                <span className="text-violet-200/40"> / {problems.length}</span>
              </p>
              <p className="text-[11px] tracking-wide text-violet-300/60 uppercase">
                Solved on this page
              </p>
            </Card>
          )
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <span
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-violet-300/40"
            aria-hidden="true"
          >
            ⌕
          </span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            placeholder="Search problems…"
            aria-label="Search problems"
            className="field pl-10"
          />
        </div>

        <div
          className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
          role="group"
          aria-label="Filter by difficulty"
        >
          {DIFFICULTIES.map((level) => (
            <button
              key={level}
              onClick={() => {
                setDifficulty(level);
                setOffset(0);
              }}
              aria-pressed={difficulty === level}
              className={[
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                difficulty === level
                  ? "bg-white/12 text-violet-50"
                  : "text-violet-200/55 hover:text-violet-100",
              ].join(" ")}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : problems.length === 0 ? (
        <Card solid>
          <EmptyState
            title="No problems match"
            description="Try a different search term or difficulty filter."
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {problems.map((problem, index) => (
            <li
              key={problem.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
            >
              <ProblemRow problem={problem} index={offset + index + 1} />
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <nav
          className="mt-8 flex items-center justify-between"
          aria-label="Pagination"
        >
          <button
            onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
            disabled={offset === 0}
            className="btn-ghost rounded-xl px-4 py-2 text-sm font-medium text-violet-100 disabled:opacity-40"
          >
            ← Previous
          </button>
          <p className="font-mono text-sm text-violet-200/50">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </p>
          <button
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="btn-ghost rounded-xl px-4 py-2 text-sm font-medium text-violet-100 disabled:opacity-40"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}

function ProblemRow({
  problem,
  index,
}: {
  problem: ProblemSummary;
  index: number;
}) {
  const attempts = problem.total_submissions ?? 0;
  const accepted = problem.accepted_submissions ?? 0;
  const rate = attempts > 0 ? Math.round((accepted / attempts) * 100) : null;

  return (
    <Link to={`/problems/${problem.slug}`} className="block">
      <Card hover edge className="flex items-center gap-4 p-5">
        <span
          className={[
            "grid size-10 shrink-0 place-items-center rounded-xl border font-mono text-sm font-bold",
            problem.solved_by_me
              ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-300"
              : problem.attempted_by_me
                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                : "border-white/10 bg-white/5 text-violet-200/50",
          ].join(" ")}
          aria-hidden="true"
        >
          {problem.solved_by_me ? "✓" : index}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-violet-50">
            {problem.title}
          </h2>
          <p className="mt-1 font-mono text-xs text-violet-200/45">
            {problem.time_limit_ms} ms · {problem.memory_limit_mb} MB
            {rate !== null && ` · ${rate}% accepted`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {problem.solved_by_me && (
            <span className="hidden text-xs font-semibold text-emerald-300 sm:block">
              Solved
            </span>
          )}
          <DifficultyBadge difficulty={problem.difficulty} />
          <span className="text-violet-300/40" aria-hidden="true">
            →
          </span>
        </div>
      </Card>
    </Link>
  );
}
