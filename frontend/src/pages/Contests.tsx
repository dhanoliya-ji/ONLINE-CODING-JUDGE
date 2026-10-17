import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import type { Contest } from "../lib/types";
import { Alert, Badge, Card, EmptyState, PageHeading, Skeleton } from "../components/ui";
import { Countdown, StateBadge } from "../components/problems/contest-bits";
import { formatDuration } from "../components/problems/contest-format";

const GROUPS: { state: Contest["state"]; title: string }[] = [
  { state: "Running", title: "Live now" },
  { state: "Upcoming", title: "Upcoming" },
  { state: "Ended", title: "Past contests" },
];

export function Contests() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .contests({ limit: 50 })
      .then((page) => setContests(page.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading
        eyebrow="Compete"
        title="Contests"
        description="Timed rounds with ICPC-style scoring: points on first solve, plus a penalty for time elapsed and rejected attempts."
      />

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <div className="space-y-4" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-[1.25rem]" />
          ))}
        </div>
      ) : contests.length === 0 ? (
        !error && (
          <Card solid>
            <EmptyState icon="◆" title="No contests yet" description="An administrator can create one from the API." />
          </Card>
        )
      ) : (
        <div className="flex flex-col gap-10">
          {GROUPS.map((group) => {
            const items = contests.filter((contest) => contest.state === group.state);
            if (items.length === 0) return null;
            return (
              <section key={group.state} aria-labelledby={`group-${group.state}`}>
                <h2
                  id={`group-${group.state}`}
                  className="mb-4 flex items-center gap-3 font-mono text-[11px] font-medium tracking-[0.16em] text-ink-3 uppercase"
                >
                  {group.title}
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  <span className="tabular-nums">{items.length}</span>
                </h2>
                <ul className="flex flex-col gap-4">
                  {items.map((contest, index) => (
                    <li key={contest.id} className="animate-rise" style={{ animationDelay: `${index * 70}ms` }}>
                      <ContestCard contest={contest} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContestCard({ contest }: { contest: Contest }) {
  const live = contest.state === "Running";
  const target = contest.state === "Upcoming" ? contest.start_time : contest.end_time;

  return (
    <Link
      to={`/contests/${contest.id}`}
      className={[
        "lift group relative isolate block overflow-hidden rounded-[1.25rem] border p-5 sm:p-6",
        live ? "border-ember/35 bg-gradient-to-br from-ember/10 via-surface to-surface" : "border-line bg-surface",
      ].join(" ")}
    >
      {live && (
        <span
          className="pointer-events-none absolute -top-24 -right-16 -z-10 size-64 rounded-full bg-ember/20 blur-3xl"
          aria-hidden="true"
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StateBadge state={contest.state} />
            {contest.is_registered && <Badge tone="info">✓ Registered</Badge>}
          </div>

          <h3 className="font-display text-xl font-bold tracking-tight text-ink transition-colors group-hover:text-ember-2">
            {contest.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">{contest.description}</p>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs sm:flex sm:flex-wrap">
            {[
              ["Starts", formatDate(contest.start_time)],
              ["Duration", formatDuration(contest.duration_minutes)],
              ["Problems", String(contest.problem_count)],
              ["Participants", String(contest.participant_count)],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-1.5">
                <dt className="text-ink-3">{label}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:flex-col sm:items-end">
          {contest.state !== "Ended" && (
            <div className="rounded-xl border border-line bg-bg-raised px-4 py-2.5 sm:min-w-40 sm:text-right">
              <p className="font-mono text-[10px] font-medium tracking-[0.14em] text-ink-3 uppercase">
                {contest.state === "Upcoming" ? "Starts in" : "Ends in"}
              </p>
              <p className="mt-0.5 font-mono text-lg font-bold text-ink tabular-nums">
                <Countdown target={target} />
              </p>
            </div>
          )}
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ember-2" aria-hidden="true">
            {live ? "Enter" : contest.state === "Upcoming" ? "Details" : "Standings"}
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
