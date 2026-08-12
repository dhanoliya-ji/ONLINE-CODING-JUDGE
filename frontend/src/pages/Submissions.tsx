import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { LANGUAGE_LABELS, formatMemory, relativeTime } from "../lib/format";
import type { Submission } from "../lib/types";
import {
  Alert,
  Card,
  EmptyState,
  PageHeading,
  Skeleton,
  VerdictBadge,
} from "../components/ui";

const VERDICTS = [
  "All",
  "Accepted",
  "Wrong Answer",
  "Time Limit Exceeded",
  "Runtime Error",
  "Compilation Error",
];

const PAGE_SIZE = 20;

export function Submissions() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [verdict, setVerdict] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .submissions({
        verdict: verdict === "All" ? undefined : verdict,
        limit: PAGE_SIZE,
        offset,
      })
      .then((page) => {
        setRows(page.items);
        setTotal(page.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [verdict, offset]);

  // Submissions carry a problem id but not a title, so resolve the titles
  // once for the page rather than per row.
  useEffect(() => {
    const missing = [...new Set(rows.map((row) => row.problem_id))].filter(
      (id) => !(id in titles),
    );
    if (missing.length === 0) return;

    Promise.allSettled(missing.map((id) => api.problem(id))).then((results) => {
      const found: Record<number, string> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          found[missing[index]] = result.value.title;
        }
      });
      if (Object.keys(found).length) {
        setTitles((current) => ({ ...current, ...found }));
      }
    });
  }, [rows, titles]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeading
        eyebrow="History"
        title="Your submissions"
        description="Every attempt you have made, with the verdict and the measurements the sandbox recorded."
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {VERDICTS.map((item) => (
          <button
            key={item}
            onClick={() => {
              setVerdict(item);
              setOffset(0);
            }}
            aria-pressed={verdict === item}
            className={[
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              verdict === item
                ? "border-violet-400/40 bg-violet-400/15 text-violet-100"
                : "border-white/10 bg-white/4 text-violet-200/55 hover:text-violet-100",
            ].join(" ")}
          >
            {item}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card solid>
          <EmptyState
            icon="◌"
            title="No submissions yet"
            description="Solve a problem and your attempts will show up here."
            action={
              <Link
                to="/problems"
                className="btn-primary mt-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              >
                Browse problems
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(index * 35, 300)}ms` }}
            >
              <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <VerdictBadge verdict={row.verdict} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-violet-50">
                    {titles[row.problem_id] ?? `Problem #${row.problem_id}`}
                  </p>
                  <p className="font-mono text-xs text-violet-200/45">
                    {LANGUAGE_LABELS[row.language] ?? row.language} ·{" "}
                    {relativeTime(row.created_at)}
                    {row.contest_id && " · contest"}
                  </p>
                </div>

                <div className="flex items-center gap-5 font-mono text-xs tabular-nums text-violet-200/60">
                  <span title="Tests passed">
                    {row.passed_tests}/{row.total_tests}
                  </span>
                  <span title="Execution time">
                    {row.execution_time_ms.toFixed(1)} ms
                  </span>
                  <span className="hidden sm:inline" title="Peak memory">
                    {formatMemory(row.memory_kb)}
                  </span>
                  <span
                    className={[
                      "w-9 text-right font-bold",
                      row.score === 100 ? "text-emerald-300" : "text-violet-100",
                    ].join(" ")}
                    title="Score"
                  >
                    {row.score}
                  </span>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
          <button
            onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
            disabled={offset === 0}
            className="btn-ghost rounded-xl px-4 py-2 text-sm text-violet-100 disabled:opacity-40"
          >
            ← Previous
          </button>
          <p className="font-mono text-sm text-violet-200/50">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </p>
          <button
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="btn-ghost rounded-xl px-4 py-2 text-sm text-violet-100 disabled:opacity-40"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
