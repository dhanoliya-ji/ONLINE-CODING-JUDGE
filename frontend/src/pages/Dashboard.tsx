import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { LANGUAGE_LABELS, relativeTime, verdictTone } from "../lib/format";
import type { Dashboard as DashboardData } from "../lib/types";
import { Alert, Card, EmptyState, Eyebrow, Skeleton, VerdictBadge } from "../components/ui";
import { Badges } from "../components/profile/Badges";
import { Heatmap } from "../components/profile/Heatmap";
import { RatingChart } from "../components/profile/RatingChart";
import { SolvedRing } from "../components/profile/SolvedRing";
import { TopicSkyline } from "../components/profile/TopicSkyline";

/** The signed-in user's profile: progress, activity and strengths. */
export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1240px] space-y-5 px-4 py-10 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-44" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <Alert>{error ?? "Could not load your profile"}</Alert>
      </div>
    );
  }

  const joined = data.member_since
    ? new Date(data.member_since).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-[1240px] space-y-5 px-4 py-10 sm:px-6">
      {/* ------------------------------------------------ top row */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card solid className="tilt relative overflow-hidden p-6">
          <div
            className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full opacity-30 blur-3xl"
            style={{ background: "var(--ember)" }}
            aria-hidden="true"
          />
          <div className="flex items-center gap-4">
            <span
              className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-ember to-frost font-display text-2xl font-bold text-ember-ink"
              aria-hidden="true"
            >
              {data.username.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-bold text-ink">{data.username}</h1>
              <p className="truncate text-sm text-ink-3">
                {data.email}
                {joined && <> · joined {joined}</>}
              </p>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
            <Figure label="day streak" value={data.current_streak} accent={data.current_streak > 0} />
            <Figure label="best streak" value={data.longest_streak} />
            <Figure label="global rank" value={data.global_rank ? `#${data.global_rank}` : "—"} />
          </dl>
          <NextSteps topics={data.tag_progress} />
        </Card>

        <Card solid className="p-6">
          <Eyebrow>Solved</Eyebrow>
          <SolvedRing progress={data.difficulty_progress} />
        </Card>

        <Card solid className="p-6">
          <Eyebrow>Submissions</Eyebrow>
          <dl className="grid grid-cols-2 gap-4">
            <Figure label="submissions" value={data.total_submissions} align="left" />
            <Figure label="acceptance" value={`${data.acceptance_rate}%`} align="left" />
            <Figure label="attempted" value={data.problems_attempted} align="left" />
            <Figure label="contests" value={data.contests_participated} align="left" />
          </dl>
          {data.verdict_breakdown.length > 0 && <VerdictBar verdicts={data.verdict_breakdown} />}
        </Card>
      </div>

      {/* -------------------------------------------------- activity */}
      <Card solid className="p-6">
        <Heatmap activity={data.activity} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card solid className="p-6">
          <Eyebrow>Contest rating</Eyebrow>
          <RatingChart history={data.rating_history} rating={data.rating} maxRating={data.max_rating} />
        </Card>
        <Card solid className="p-6">
          <Eyebrow>Badges</Eyebrow>
          <Badges badges={data.badges} />
        </Card>
      </div>

      {data.total_submissions === 0 ? (
        <Card solid>
          <EmptyState
            icon="▲"
            title="Nothing here yet"
            description="Solve your first problem and your activity, strengths and streaks will appear here."
            action={
              <Link to="/problems" className="btn-primary mt-2 rounded-xl px-5 py-2.5 text-sm font-semibold">
                Browse problems
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card solid className="p-6">
            <h2 className="font-display text-lg font-bold text-ink">Topic mastery</h2>
            <p className="mt-1 mb-2 text-sm text-ink-3">
              Taller means a bigger share of that topic solved. Pick a topic to practise what you haven't tried yet.
            </p>
            {data.tag_progress.length > 0 ? (
              <TopicSkyline topics={data.tag_progress} />
            ) : (
              <p className="py-10 text-center text-sm text-ink-3">Topics appear once problems are tagged.</p>
            )}
          </Card>

          <div className="space-y-5">
            <Card solid className="p-6">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-bold text-ink">Recent</h2>
                <Link to="/submissions" className="text-sm text-ember hover:underline">
                  All submissions →
                </Link>
              </div>
              <ul className="divide-y divide-line">
                {data.recent_submissions.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/problems/${s.problem_slug ?? s.problem_id}`}
                      className="flex items-center gap-3 py-2.5 text-sm hover:text-ink"
                    >
                      <span className="min-w-0 flex-1 truncate text-ink-2">{s.problem_title ?? `Problem #${s.problem_id}`}</span>
                      <VerdictBadge verdict={s.verdict} />
                      <span className="hidden w-20 shrink-0 text-right text-xs text-ink-3 sm:block">{relativeTime(s.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            {data.language_usage.length > 0 && (
              <Card solid className="p-6">
                <h2 className="mb-3 font-display text-lg font-bold text-ink">Languages</h2>
                <ul className="space-y-2.5">
                  {data.language_usage.map((l) => (
                    <li key={l.language}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-ink-2">{LANGUAGE_LABELS[l.language] ?? l.language}</span>
                        <span className="font-mono text-xs text-ink-3">
                          <span className="text-ink">{l.accepted}</span> / {l.submissions} accepted
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-frost"
                          style={{ width: `${(l.submissions / data.total_submissions) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Two quick ways back into practice: the weakest topic, and today's problem. */
function NextSteps({ topics }: { topics: DashboardData["tag_progress"] }) {
  const navigate = useNavigate();
  const weakest = [...topics]
    .filter((t) => t.total > t.solved)
    .sort((a, b) => a.solved / a.total - b.solved / b.total)[0];
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {weakest && (
        <Link to={`/problems?tags=${weakest.slug}&status=todo`} className="btn-primary rounded-lg px-3 py-2 text-xs font-semibold">
          Practise {weakest.name} →
        </Link>
      )}
      <button
        onClick={() =>
          api
            .dailyProblem()
            .then((p) => navigate(`/problems/${p.slug}`))
            .catch(() => navigate("/problems"))
        }
        className="btn-ghost rounded-lg px-3 py-2 text-xs font-semibold"
      >
        Today's problem
      </button>
    </div>
  );
}

function Figure({
  label,
  value,
  accent = false,
  align = "center",
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "left" ? "text-left" : undefined}>
      <dd className={`font-mono text-2xl font-bold tabular-nums ${accent ? "text-ember" : "text-ink"}`}>{value}</dd>
      <dt className="mt-0.5 text-[11px] tracking-wider text-ink-3 uppercase">{label}</dt>
    </div>
  );
}

const TONE_BG: Record<string, string> = {
  pass: "var(--pass)",
  fail: "var(--fail)",
  warn: "var(--warn)",
  info: "var(--info)",
  muted: "var(--ink-3)",
};

/** Verdict mix as one stacked bar; the legend carries the numbers. */
function VerdictBar({ verdicts }: { verdicts: { verdict: string; count: number }[] }) {
  const total = verdicts.reduce((sum, v) => sum + v.count, 0);
  return (
    <div className="mt-5">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        {verdicts.map((v) => (
          <span key={v.verdict} style={{ width: `${(v.count / total) * 100}%`, background: TONE_BG[verdictTone(v.verdict).tone] }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
        {verdicts.map((v) => (
          <li key={v.verdict} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: TONE_BG[verdictTone(v.verdict).tone] }} aria-hidden="true" />
            {v.verdict} <span className="font-mono text-ink-2">{v.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
