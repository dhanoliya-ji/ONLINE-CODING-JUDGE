import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { LANGUAGE_LABELS, formatMemory, relativeTime } from "../lib/format";
import type { Submission } from "../lib/types";
import { Alert, Card, EmptyState, PageHeading, Skeleton, VerdictBadge } from "../components/ui";

const VERDICTS = ["All", "Accepted", "Wrong Answer", "Time Limit Exceeded", "Runtime Error", "Compilation Error"];

const PAGE_SIZE = 20;

export function Submissions() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [verdict, setVerdict] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .submissions({ verdict: verdict === "All" ? undefined : verdict, limit: PAGE_SIZE, offset })
      .then((page) => {
        if (cancelled) return;
        setRows(page.items);
        setTotal(page.total);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [verdict, offset]);

  function choose(next: string) {
    setLoading(true);
    setVerdict(next);
    setOffset(0);
  }

  function page(next: number) {
    setLoading(true);
    setOffset(next);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="History"
        title="Your submissions"
        description="Every attempt you have made, with the verdict and what the sandbox measured."
      />

      <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label="Filter by verdict">
        {VERDICTS.map((item) => (
          <button key={item} onClick={() => choose(item)} aria-pressed={verdict === item} className="chip">
            {item}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[68px] w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card solid>
          <EmptyState
            icon="◌"
            title={verdict === "All" ? "No submissions yet" : `No “${verdict}” submissions`}
            description="Solve a problem and your attempts will show up here."
            action={
              <Link to="/problems" className="btn-primary mt-2 rounded-xl px-5 py-2.5 text-sm font-semibold">
                Browse problems
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row, index) => (
            <li key={row.id} className="animate-rise" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}>
              <Link
                to={`/problems/${row.problem_slug ?? row.problem_id}`}
                className="panel lift flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
              >
                <VerdictBadge verdict={row.verdict} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{row.problem_title ?? `Problem #${row.problem_id}`}</p>
                  <p className="font-mono text-xs text-ink-3">
                    {LANGUAGE_LABELS[row.language] ?? row.language} · {relativeTime(row.created_at)}
                    {row.contest_id && " · contest"}
                  </p>
                </div>
                <div className="flex items-center gap-5 font-mono text-xs text-ink-2 tabular-nums">
                  <span title="Tests passed">
                    {row.passed_tests}/{row.total_tests}
                  </span>
                  <span title="Execution time">{row.execution_time_ms.toFixed(0)} ms</span>
                  <span className="hidden sm:inline" title="Peak memory">
                    {formatMemory(row.memory_kb)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
          <button
            onClick={() => page(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="btn-ghost rounded-xl px-4 py-2 text-sm"
          >
            ← Previous
          </button>
          <p className="font-mono text-sm text-ink-3">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </p>
          <button
            onClick={() => page(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="btn-ghost rounded-xl px-4 py-2 text-sm"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
