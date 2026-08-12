import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { countdown, formatDate } from "../lib/format";
import type { Contest, ContestProblem, Leaderboard } from "../lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  DifficultyBadge,
  EmptyState,
  Skeleton,
} from "../components/ui";

export function ContestDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();

  const [contest, setContest] = useState<Contest | null>(null);
  const [problems, setProblems] = useState<ContestProblem[]>([]);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [problemsLocked, setProblemsLocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const found = await api.contest(id);
      setContest(found);

      const [problemResult, boardResult] = await Promise.allSettled([
        api.contestProblems(found.id),
        api.leaderboard(found.id),
      ]);

      if (problemResult.status === "fulfilled") {
        setProblems(problemResult.value);
        setProblemsLocked(null);
      } else {
        // The API withholds the problem set until a contest starts.
        setProblemsLocked(
          problemResult.reason?.message ?? "Problems are not available yet",
        );
      }

      if (boardResult.status === "fulfilled") setBoard(boardResult.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load contest");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!contest || contest.state === "Ended") return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [contest]);

  async function toggleRegistration() {
    if (!contest) return;
    setJoining(true);
    setError(null);
    try {
      if (contest.is_registered) {
        await api.leaveContest(contest.id);
      } else {
        await api.joinContest(contest.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update registration");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <Alert>{error ?? "Contest not found"}</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6" key={tick}>
      <Link
        to="/contests"
        className="mb-3 inline-block text-sm text-violet-300/70 hover:text-violet-200"
      >
        ← Contests
      </Link>

      {/* Header */}
      <Card solid edge className="mb-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <Badge
                tone={
                  contest.state === "Running"
                    ? "pass"
                    : contest.state === "Upcoming"
                      ? "info"
                      : "muted"
                }
              >
                {contest.state}
              </Badge>
              {contest.is_registered && <Badge tone="info">✓ Registered</Badge>}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-violet-50">
              {contest.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-violet-200/60">
              {contest.description}
            </p>

            <dl className="mt-5 grid gap-x-8 gap-y-2 font-mono text-xs text-violet-200/50 sm:grid-cols-2">
              <div className="flex gap-2">
                <dt>Window</dt>
                <dd className="text-violet-100/80">
                  {formatDate(contest.start_time)} → {formatDate(contest.end_time)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt>Penalty</dt>
                <dd className="text-violet-100/80">
                  +{contest.penalty_minutes_per_wrong} min per rejected attempt
                </dd>
              </div>
            </dl>
          </div>

          <div className="shrink-0 space-y-3 text-center">
            {contest.state !== "Ended" && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
                <p className="text-[10px] font-semibold tracking-wider text-violet-300/60 uppercase">
                  {contest.state === "Upcoming" ? "Starts in" : "Ends in"}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-violet-50">
                  {countdown(
                    contest.state === "Upcoming"
                      ? contest.start_time
                      : contest.end_time,
                  )}
                </p>
              </div>
            )}

            {user ? (
              contest.state !== "Ended" && (
                <Button
                  variant={contest.is_registered ? "ghost" : "primary"}
                  loading={joining}
                  onClick={toggleRegistration}
                  className="w-full"
                >
                  {contest.is_registered ? "Withdraw" : "Join contest"}
                </Button>
              )
            ) : (
              <Link
                to="/login"
                state={{ from: `/contests/${id}` }}
                className="btn-primary block rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              >
                Sign in to join
              </Link>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* Problems */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-violet-50">Problems</h2>

          {problemsLocked ? (
            <Card solid>
              <EmptyState
                icon="⧗"
                title="Problems are sealed"
                description={problemsLocked}
              />
            </Card>
          ) : problems.length === 0 ? (
            <Card solid>
              <EmptyState icon="◇" title="No problems in this contest yet" />
            </Card>
          ) : (
            <ul className="space-y-3">
              {problems.map((entry) => (
                <li key={entry.id}>
                  <Link to={`/problems/${entry.problem.slug}`}>
                    <Card hover className="flex items-center gap-4 p-4">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-lg border border-violet-400/25 bg-violet-400/12 font-mono text-sm font-bold text-violet-200"
                        aria-hidden="true"
                      >
                        {entry.label ?? "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-violet-50">
                          {entry.problem.title}
                        </p>
                        <p className="font-mono text-xs text-violet-200/45">
                          {entry.points} points
                        </p>
                      </div>
                      <DifficultyBadge difficulty={entry.problem.difficulty} />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Leaderboard */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-violet-50">Leaderboard</h2>
            {board && (
              <span className="font-mono text-xs text-violet-200/45">
                {board.total_participants} participants
              </span>
            )}
          </div>

          {!board || board.entries.length === 0 ? (
            <Card solid>
              <EmptyState
                icon="◈"
                title="No standings yet"
                description="Join the contest and submit a solution to appear here."
              />
            </Card>
          ) : (
            <Card solid className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-left">
                      <Th className="w-14">#</Th>
                      <Th>User</Th>
                      <Th className="text-right">Solved</Th>
                      <Th className="text-right">Score</Th>
                      <Th className="text-right">Penalty</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.entries.map((entry) => {
                      const isMe = user?.username === entry.username;
                      return (
                        <tr
                          key={entry.user_id}
                          className={[
                            "border-b border-white/5 last:border-0",
                            isMe ? "bg-violet-400/8" : "",
                          ].join(" ")}
                        >
                          <td className="px-4 py-3">
                            <RankBadge rank={entry.rank} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-violet-50">
                              {entry.username}
                            </span>
                            {isMe && (
                              <span className="ml-2 text-[10px] font-semibold tracking-wider text-violet-300/70 uppercase">
                                you
                              </span>
                            )}
                            {entry.problems.some((cell) => cell.solved) && (
                              <div className="mt-1.5 flex gap-1">
                                {entry.problems.map((cell) => (
                                  <span
                                    key={cell.problem_id}
                                    title={
                                      cell.solved
                                        ? `${cell.label ?? "?"} solved at +${cell.solved_at_minutes}m (${cell.attempts} attempt${cell.attempts === 1 ? "" : "s"})`
                                        : `${cell.label ?? "?"} unsolved`
                                    }
                                    className={[
                                      "grid size-5 place-items-center rounded font-mono text-[10px] font-bold",
                                      cell.solved
                                        ? "bg-emerald-400/20 text-emerald-300"
                                        : cell.attempts > 0
                                          ? "bg-rose-400/15 text-rose-300"
                                          : "bg-white/6 text-violet-200/35",
                                    ].join(" ")}
                                  >
                                    {cell.label ?? "?"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-violet-100">
                            {entry.solved}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-violet-50">
                            {entry.score}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-violet-200/55">
                            {entry.penalty}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-white/8 px-4 py-3 text-xs text-violet-200/40">
                Ranked by score, then by penalty. Penalty counts minutes to each
                solve plus {contest.penalty_minutes_per_wrong} per rejected
                attempt on problems eventually solved.
              </p>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold tracking-wide text-violet-300/60 uppercase ${className}`}
    >
      {children}
    </th>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
      : rank === 2
        ? "border-slate-300/35 bg-slate-300/12 text-slate-200"
        : rank === 3
          ? "border-orange-400/35 bg-orange-400/12 text-orange-300"
          : "border-white/10 bg-white/5 text-violet-200/60";

  return (
    <span
      className={`grid size-7 place-items-center rounded-lg border font-mono text-xs font-bold ${medal}`}
    >
      {rank}
    </span>
  );
}
