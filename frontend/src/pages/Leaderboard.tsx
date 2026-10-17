import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { LeaderboardRow } from "../lib/types";
import { Alert, Button, Card, EmptyState, PageHeading, Skeleton } from "../components/ui";
import { Pagination } from "../components/problems/Pagination";
import { useKeyedRequest } from "../components/problems/useKeyedRequest";

const PAGE_SIZE = 50;

const loadPage = (page: string) =>
  api.globalLeaderboard({ limit: PAGE_SIZE, offset: (Number(page) - 1) * PAGE_SIZE });

/* ------------------------------------------------------------ Breakdown */

/** Easy / medium / hard as one stacked bar; the legend carries the numbers. */
function Breakdown({ row, compact = false }: { row: LeaderboardRow; compact?: boolean }) {
  const parts = [
    { key: "Easy", value: row.easy, bar: "bg-pass", text: "text-pass" },
    { key: "Medium", value: row.medium, bar: "bg-warn", text: "text-warn" },
    { key: "Hard", value: row.hard, bar: "bg-fail", text: "text-fail" },
  ];
  const sum = Math.max(1, row.easy + row.medium + row.hard);
  const label = `${row.easy} easy, ${row.medium} medium, ${row.hard} hard`;

  return (
    <div className={compact ? "w-full" : "w-full max-w-64"}>
      <div
        role="img"
        aria-label={label}
        className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-surface-3"
      >
        {parts.map((part) =>
          part.value > 0 ? (
            <span key={part.key} className={part.bar} style={{ width: `${(part.value / sum) * 100}%` }} />
          ) : null,
        )}
      </div>
      <p className="mt-1.5 flex gap-3 font-mono text-[11px] text-ink-3 tabular-nums" aria-hidden="true">
        {parts.map((part) => (
          <span key={part.key}>
            <span className={part.text}>{part.key[0]}</span> {part.value}
          </span>
        ))}
      </p>
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-ember to-frost font-bold text-ember-ink",
        size === "lg" ? "size-14 text-xl" : "size-8 text-sm",
      ].join(" ")}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/* --------------------------------------------------------------- Podium */

const MEDAL = {
  1: { label: "1st", ring: "border-ember/55", glow: "from-ember/18", chip: "bg-ember-2 text-ember-ink", lift: "sm:-mt-6" },
  2: { label: "2nd", ring: "border-frost/45", glow: "from-frost/12", chip: "bg-frost text-bg", lift: "" },
  3: { label: "3rd", ring: "border-warn/40", glow: "from-warn/10", chip: "bg-warn text-bg", lift: "" },
} as const;

function Podium({ rows, me }: { rows: LeaderboardRow[]; me: string | undefined }) {
  // Desktop order is 2 · 1 · 3 so the winner stands in the middle.
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  return (
    <ol aria-label="Top three" className="mb-8 grid gap-4 sm:grid-cols-3 sm:items-end sm:pt-6">
      {order.map((row) => {
        const medal = MEDAL[row.rank as 1 | 2 | 3] ?? MEDAL[3];
        const isMe = row.username === me;
        return (
          <li
            key={row.username}
            className={[
              "tilt relative overflow-hidden rounded-[1.25rem] border bg-gradient-to-b to-surface p-5 text-center",
              medal.ring,
              medal.glow,
              medal.lift,
              row.rank === 1 ? "sm:pb-8" : "",
              // On phones the list reads top-down: 1, 2, 3.
              row.rank === 1 ? "order-first sm:order-none" : "",
              order.length === 1 ? "sm:col-start-2" : "",
            ].join(" ")}
          >
            <span
              className={`absolute top-4 left-4 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${medal.chip}`}
            >
              {medal.label}
            </span>
            {isMe && (
              <span className="absolute top-4 right-4 rounded-full border border-ember/40 bg-ember/12 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-ember-2 uppercase">
                You
              </span>
            )}
            <div className="mt-6 flex flex-col items-center gap-2">
              <Avatar name={row.username} size="lg" />
              <p className="max-w-full truncate text-lg font-semibold text-ink">{row.username}</p>
              <p className="font-display text-3xl font-bold text-ink tabular-nums">
                {row.solved}
                <span className="ml-1.5 font-sans text-sm font-medium text-ink-3">solved</span>
              </p>
              <div className="mt-1 w-full max-w-56">
                <Breakdown row={row} compact />
              </div>
              <p className="mt-1 font-mono text-xs text-ink-3">
                {row.submissions.toLocaleString()} subs · {row.acceptance_rate.toFixed(1)}% acc.
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------------------------------------------------- Page */

const TH = "px-4 py-3 font-mono text-[11px] font-medium tracking-[0.1em] text-ink-3 uppercase";

export function Leaderboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const request = useKeyedRequest(String(page), loadPage);
  const { loading, error } = request;
  const rows = request.value?.items ?? [];
  const total = request.value?.total ?? 0;

  const me = user?.username;
  const podium = page === 1 ? rows.filter((row) => row.rank <= 3) : [];
  const tableRows = page === 1 ? rows.filter((row) => row.rank > 3) : rows;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading
        eyebrow="Hall of the forge"
        title="Leaderboard"
        description="Everyone ranked by distinct problems solved. Ties go to more hard solves, then more medium, then fewer submissions."
        actions={
          total > 0 && (
            <p className="font-mono text-sm text-ink-3" aria-live="polite">
              <span className="text-ink">{total.toLocaleString()}</span> ranked solver{total === 1 ? "" : "s"}
            </p>
          )
        }
      />

      {error ? (
        <Card solid className="p-6">
          <Alert>{error}</Alert>
          <Button variant="ghost" size="sm" className="mt-4" onClick={request.retry}>
            Try again
          </Button>
        </Card>
      ) : loading && rows.length === 0 ? (
        <div aria-hidden="true">
          <div className="mb-8 grid gap-4 sm:grid-cols-3 sm:items-end sm:pt-6">
            <Skeleton className="h-64 rounded-[1.25rem]" />
            <Skeleton className="h-72 rounded-[1.25rem]" />
            <Skeleton className="h-64 rounded-[1.25rem]" />
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <Card solid>
          <EmptyState
            icon="◈"
            title="Nobody on the board yet"
            description="Solve a problem and you'll be the first name here."
            action={
              <Link to="/problems" className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
                Browse problems
              </Link>
            }
          />
        </Card>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {podium.length > 0 && <Podium rows={podium} me={me} />}

          {tableRows.length > 0 && (
            <>
              {/* Tablet and up */}
              <div className="panel hidden overflow-hidden md:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">Global leaderboard, page {page}</caption>
                  <thead>
                    <tr className="border-b border-line bg-surface-2/50 text-left">
                      <th scope="col" className={`${TH} w-20`}>
                        Rank
                      </th>
                      <th scope="col" className={TH}>
                        Solver
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        Solved
                      </th>
                      <th scope="col" className={`${TH} w-64`}>
                        Breakdown
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        Submissions
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        Accept.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => {
                      const isMe = row.username === me;
                      return (
                        <tr
                          key={row.username}
                          aria-current={isMe ? "true" : undefined}
                          className={[
                            "border-b border-line last:border-0 transition-colors",
                            isMe ? "bg-ember/10 shadow-[inset_3px_0_0_var(--ember)]" : "hover:bg-surface-2/70",
                          ].join(" ")}
                        >
                          <td className="px-4 py-3 font-mono text-ink-2 tabular-nums">#{row.rank}</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-3">
                              <Avatar name={row.username} />
                              <span className="truncate font-medium text-ink">{row.username}</span>
                              {isMe && (
                                <span className="rounded-full border border-ember/40 bg-ember/12 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-ember-2 uppercase">
                                  You
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-base font-bold text-ink tabular-nums">
                            {row.solved}
                          </td>
                          <td className="px-4 py-3">
                            <Breakdown row={row} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-ink-2 tabular-nums">
                            {row.submissions.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-ink-2 tabular-nums">
                            {row.acceptance_rate.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phones */}
              <ol className="flex flex-col gap-2.5 md:hidden" aria-label={`Ranks, page ${page}`}>
                {tableRows.map((row) => {
                  const isMe = row.username === me;
                  return (
                    <li
                      key={row.username}
                      aria-current={isMe ? "true" : undefined}
                      className={["panel flex items-start gap-3 p-4", isMe ? "border-ember/50 bg-ember/8" : ""].join(" ")}
                    >
                      <span className="w-10 shrink-0 pt-1 font-mono text-sm text-ink-2">#{row.rank}</span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2">
                          <span className="truncate font-medium text-ink">{row.username}</span>
                          {isMe && <span className="text-[10px] font-semibold tracking-wider text-ember-2 uppercase">You</span>}
                          <span className="ml-auto font-mono font-bold text-ink">{row.solved}</span>
                        </p>
                        <div className="mt-2">
                          <Breakdown row={row} compact />
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-ink-3">
                          {row.submissions} subs · {row.acceptance_rate.toFixed(1)}% acc.
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}

          <div className="mt-6">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              label="Leaderboard pages"
              onChange={(next) => {
                setParams(next > 1 ? { page: String(next) } : {});
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
