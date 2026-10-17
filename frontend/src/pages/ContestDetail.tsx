import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate } from "../lib/format";
import type { Contest, ContestProblem, Leaderboard } from "../lib/types";
import { Alert, Badge, Button, Card, DifficultyBadge, EmptyState, Skeleton } from "../components/ui";
import { Countdown, StateBadge } from "../components/problems/contest-bits";
import { VirtualPanel } from "../components/problems/VirtualPanel";
import { formatDuration } from "../components/problems/contest-format";

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
        setProblemsLocked(problemResult.reason?.message ?? "Problems are not available yet");
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
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6" aria-hidden="true">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-52 w-full rounded-[1.25rem]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <Alert>{error ?? "Contest not found"}</Alert>
        <Link to="/contests" className="mt-4 inline-block text-sm text-ember-2 hover:text-ember">
          ← All contests
        </Link>
      </div>
    );
  }

  const live = contest.state === "Running";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/contests"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Contests
      </Link>

      {/* Header */}
      <section
        aria-labelledby="contest-title"
        className={[
          "relative isolate mb-8 overflow-hidden rounded-[1.25rem] border p-6 animate-rise sm:p-8",
          live ? "border-ember/35 bg-gradient-to-br from-ember/12 via-surface to-surface" : "border-line bg-surface",
        ].join(" ")}
      >
        <span
          className="pointer-events-none absolute -top-28 -right-20 -z-10 size-72 rounded-full bg-ember/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-[1_1_360px]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StateBadge state={contest.state} />
              {contest.is_auto && <Badge tone="muted">Weekly</Badge>}
              <Badge tone={contest.rated ? "warn" : "muted"}>{contest.rated ? "Rated" : "Unrated"}</Badge>
              {contest.is_registered && <Badge tone="info">✓ Registered</Badge>}
            </div>

            <h1 id="contest-title" className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {contest.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-2">{contest.description}</p>

            <dl className="mt-5 grid gap-x-8 gap-y-3 font-mono text-xs sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-ink-3">Window</dt>
                <dd className="text-ink">
                  {formatDate(contest.start_time)} → {formatDate(contest.end_time)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-ink-3">Penalty</dt>
                <dd className="text-ink">+{contest.penalty_minutes_per_wrong} min per rejected attempt</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-ink-3">Duration</dt>
                <dd className="text-ink">{formatDuration(contest.duration_minutes)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-ink-3">Field</dt>
                <dd className="text-ink">
                  {contest.problem_count} problems · {contest.participant_count} participants
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-60">
            {contest.state !== "Ended" && (
              <div className="rounded-xl border border-line bg-bg-raised px-5 py-4 text-center">
                <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-ink-3 uppercase">
                  {contest.state === "Upcoming" ? "Starts in" : "Ends in"}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-ink tabular-nums">
                  {/* Reload when it hits zero: the problems unseal, or the contest closes. */}
                  <Countdown
                    target={contest.state === "Upcoming" ? contest.start_time : contest.end_time}
                    onElapsed={load}
                  />
                </p>
              </div>
            )}

            {user && contest.state === "Ended" && <VirtualPanel contest={contest} />}
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
                className="btn-primary inline-flex min-h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold"
              >
                Sign in to join
              </Link>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* Problems */}
        <section aria-labelledby="contest-problems">
          <SectionTitle id="contest-problems">Problems</SectionTitle>

          {problemsLocked ? (
            <Card solid>
              <EmptyState icon="⧗" title="Problems are sealed" description={problemsLocked} />
            </Card>
          ) : problems.length === 0 ? (
            <Card solid>
              <EmptyState icon="◇" title="No problems in this contest yet" />
            </Card>
          ) : (
            <ul className="panel divide-y divide-line overflow-hidden">
              {problems.map((entry) => (
                <li key={entry.id}>
                  <Link
                    to={`/problems/${entry.problem.slug}?contest=${contest.id}`}
                    className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-lg border border-ember/35 bg-ember/10 font-mono text-sm font-bold text-ember-2"
                      aria-hidden="true"
                    >
                      {entry.label ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink transition-colors group-hover:text-ember-2">
                        <span className="sr-only">Problem {entry.label ?? ""}: </span>
                        {entry.problem.title}
                      </span>
                      <span className="font-mono text-xs text-ink-3">{entry.points} points</span>
                    </span>
                    {entry.problem.solved_by_me && (
                      <span className="text-sm font-bold text-pass" role="img" aria-label="Solved">
                        ✓
                      </span>
                    )}
                    <DifficultyBadge difficulty={entry.problem.difficulty} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Leaderboard */}
        <section aria-labelledby="contest-standings">
          <SectionTitle
            id="contest-standings"
            aside={board && `${board.total_participants} participant${board.total_participants === 1 ? "" : "s"}`}
          >
            Standings
          </SectionTitle>

          {!board || board.entries.length === 0 ? (
            <Card solid>
              <EmptyState
                icon="◈"
                title="No standings yet"
                description="Join the contest and submit a solution to appear here."
              />
            </Card>
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Contest standings</caption>
                  <thead>
                    <tr className="border-b border-line bg-surface-2/50 text-left">
                      <Th className="w-12">#</Th>
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
                          aria-current={isMe ? "true" : undefined}
                          className={[
                            "border-b border-line last:border-0",
                            isMe ? "bg-ember/10 shadow-[inset_3px_0_0_var(--ember)]" : "",
                          ].join(" ")}
                        >
                          <td className="px-2.5 py-3 sm:px-4">
                            <RankBadge rank={entry.rank} />
                          </td>
                          <td className="px-2.5 py-3 sm:px-4">
                            <span className="font-medium text-ink">{entry.username}</span>
                            {isMe && (
                              <span className="ml-2 text-[10px] font-semibold tracking-wider text-ember-2 uppercase">
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
                                        ? "bg-pass/15 text-pass"
                                        : cell.attempts > 0
                                          ? "bg-fail/12 text-fail"
                                          : "bg-surface-2 text-ink-3",
                                    ].join(" ")}
                                  >
                                    {cell.label ?? "?"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-3 sm:px-4 text-right font-mono text-ink-2 tabular-nums">{entry.solved}</td>
                          <td className="px-2.5 py-3 sm:px-4 text-right font-mono font-bold text-ink tabular-nums">
                            {entry.score}
                          </td>
                          <td className="px-2.5 py-3 sm:px-4 text-right font-mono text-ink-3 tabular-nums">{entry.penalty}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-line px-4 py-3 text-xs text-ink-3">
                Ranked by score, then by penalty. Penalty counts minutes to each solve plus{" "}
                {contest.penalty_minutes_per_wrong} per rejected attempt on problems eventually solved.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold text-ink">
        {children}
      </h2>
      {aside && <span className="font-mono text-xs text-ink-3">{aside}</span>}
    </div>
  );
}

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-2.5 py-3 font-mono text-[11px] font-medium tracking-[0.1em] sm:px-4 text-ink-3 uppercase ${className}`}
    >
      {children}
    </th>
  );
}

const MEDALS: Record<number, string> = {
  1: "border-ember/50 bg-ember/15 text-ember-2",
  2: "border-frost/45 bg-frost/12 text-frost",
  3: "border-warn/45 bg-warn/12 text-warn",
};

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={[
        "grid size-7 place-items-center rounded-lg border font-mono text-xs font-bold",
        MEDALS[rank] ?? "border-line bg-surface-2 text-ink-2",
      ].join(" ")}
    >
      {rank}
    </span>
  );
}
