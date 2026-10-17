import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Contest, Facets, ProblemSummary } from "../lib/types";
import { HeroVisual } from "../components/landing/HeroVisual";

const LANGUAGES = ["Python", "C++", "Java", "C", "JavaScript", "TypeScript", "Go", "Rust", "Ruby", "PHP"];

// Shown until the facets arrive, or if they never do.
const FALLBACK_TOPICS = [
  "Math",
  "Implementation",
  "Greedy",
  "Dynamic Programming",
  "Sorting",
  "Data Structures",
  "Strings",
  "Number Theory",
  "Binary Search",
  "Graphs",
  "Constructive",
  "Combinatorics",
  "Two Pointers",
  "Bit Manipulation",
  "Geometry",
  "Trees",
  "Hashing",
  "Shortest Paths",
];

const STEPS = [
  { n: "01", title: "Write", body: "Ten languages in a full editor, with your own custom input to try before you submit." },
  { n: "02", title: "Sandbox", body: "Compiled and run in isolation: no network, hard memory and time limits, a capped process count." },
  { n: "03", title: "Judge", body: "Samples run first, then the hidden tests, one by one. Hidden data never leaves the server." },
  { n: "04", title: "Verdict", body: "Accepted, wrong answer, time or memory limit, runtime or compile error, with real timings." },
];

const FEATURES = [
  {
    mark: "#",
    title: "Tags & filters",
    body: "Filter by topic, difficulty, source, rating and status. Full-text search across every statement.",
  },
  {
    mark: "◎",
    title: "Daily & random",
    body: "One shared problem of the day, or roll a random pick at your level from the topics you choose.",
  },
  {
    mark: "?",
    title: "AI practice coach",
    body: "Stuck? Ask for a hint and get a nudge, not the answer. The coach switches off during live contests.",
  },
  {
    mark: "★",
    title: "Contests & leaderboard",
    body: "Timed rounds with ICPC scoring and wrong-attempt penalties, plus a global leaderboard.",
  },
  {
    mark: "▦",
    title: "Your progress",
    body: "A profile with an activity heatmap, streaks, solved-by-difficulty and your recent verdicts.",
  },
  {
    mark: "⌘",
    title: "Ten languages, no friction",
    body: "Python to Rust in one editor. Jump anywhere with the Ctrl K command palette, in a dark or light theme.",
  },
];

export function Landing() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [facetsFailed, setFacetsFailed] = useState(false);
  const [daily, setDaily] = useState<ProblemSummary | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);

  useEffect(() => {
    let live = true;
    api
      .facets()
      .then((f) => live && setFacets(f))
      .catch(() => live && setFacetsFailed(true));
    api
      .dailyProblem()
      .then((p) => live && setDaily(p))
      .catch(() => {});
    api
      .contests({ limit: 10 })
      .then((page) => {
        // Prefer a round that is running now, then the next one to start.
        const pick =
          page.items.find((c) => c.state === "Running") ?? page.items.find((c) => c.state === "Upcoming") ?? null;
        if (live) setContest(pick);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const problemCount = facets ? Object.values(facets.difficulties).reduce((sum, n) => sum + n, 0) : null;
  const sourceNames = facets && Object.keys(facets.sources).length ? Object.keys(facets.sources) : ["Codeforces", "AtCoder", "CodeChef"];
  const sources = new Intl.ListFormat("en", { type: "conjunction" }).format(sourceNames);
  const topics = facets?.tags.length ? facets.tags.map((t) => t.name) : FALLBACK_TOPICS;

  return (
    <div className="overflow-x-clip">
      {/* ------------------------------------------------------------ Hero */}
      <section className="mx-auto flex max-w-[1240px] flex-col items-center gap-6 px-4 pt-10 pb-12 sm:px-8 sm:pt-14 lg:flex-row lg:gap-10 lg:pb-20">
        <div className="w-full min-w-0 lg:flex-[1_1_52%]">
          <p className="animate-rise mb-6 inline-flex max-w-full items-start gap-2.5 rounded-2xl border border-line-strong bg-surface/60 px-3.5 py-1.5 font-mono text-[12px] leading-relaxed text-ink-2 backdrop-blur xl:rounded-full">
            <span className="mt-[6px] size-2 shrink-0 rounded-full bg-pass" aria-hidden="true" />
            <span className="sr-only">Judged in a sandbox in ten languages: </span>
            <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
              {LANGUAGES.map((lang, i) => (
                <span key={lang} className="whitespace-nowrap">
                  {i > 0 && (
                    <span className="mr-1.5 text-ink-3" aria-hidden="true">
                      ·
                    </span>
                  )}
                  {lang}
                </span>
              ))}
            </span>
          </p>

          <h1
            className="animate-rise font-display text-[clamp(2.4rem,6vw,4.75rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance text-ink"
            style={{ animationDelay: "60ms" }}
          >
            Forge your skills under <span className="bg-gradient-to-br from-ember-2 to-ember bg-clip-text text-transparent">real</span> judging.
          </h1>

          <p
            className="animate-rise mt-6 max-w-[34rem] text-[17px] leading-relaxed text-pretty text-ink-2 sm:text-[19px]"
            style={{ animationDelay: "120ms" }}
          >
            {problemCount ? `${problemCount} problems` : "Hundreds of problems"} from {sources}{" "}
            across every core topic. Filter by tag and difficulty, and get a verdict on hidden tests in the same request.
          </p>

          <div className="animate-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
            <Link to="/problems" className="btn-primary rounded-2xl px-6 py-3.5 text-[16px] font-semibold sm:text-[17px]">
              Start solving — it's free
            </Link>
            <Link
              to={daily ? `/problems/${daily.slug}` : "/contests"}
              className="btn-ghost rounded-2xl px-5 py-3.5 text-[16px] font-medium sm:text-[17px]"
            >
              {daily ? "Try today's problem" : "Browse contests"}
            </Link>
          </div>

          <dl className="animate-rise mt-10 flex flex-wrap gap-x-10 gap-y-5" style={{ animationDelay: "240ms" }} aria-live="polite">
            <HeroStat label="problems" value={problemCount} failed={facetsFailed} />
            <HeroStat label="topics" value={facets ? facets.tags.length : null} failed={facetsFailed} />
            <HeroStat label="languages" value={LANGUAGES.length} />
          </dl>
        </div>

        <div className="w-full min-w-0 lg:flex-[1_1_48%]">
          <HeroVisual />
        </div>
      </section>

      {/* ---------------------------------------------------- Topic marquee */}
      <section aria-label="Topics" className="marquee-track overflow-hidden border-y border-line bg-bg-raised/40 py-4">
        <ul className="sr-only">
          {topics.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        {/* Two copies back to back, so the -50% loop is seamless. */}
        <div className="marquee flex w-max gap-3" aria-hidden="true">
          {[...topics, ...topics].map((name, i) => (
            <span key={`${name}-${i}`} className="rounded-full border border-line-strong px-4 py-2 text-sm whitespace-nowrap text-ink-2">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- Pipeline */}
      <section className="mx-auto max-w-[1240px] px-4 pt-20 pb-10 sm:px-8 sm:pt-24">
        <p className="font-mono text-[13px] tracking-[0.08em] text-ember [[data-theme=light]_&]:text-ember-2">HOW A SUBMISSION TRAVELS</p>
        <h2 className="mt-3 mb-10 font-display text-[clamp(1.75rem,3.4vw,2.75rem)] leading-tight font-bold tracking-[-0.01em] text-balance text-ink">
          From keystroke to verdict in one request.
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="tilt flex min-h-[190px] flex-col gap-3 rounded-[20px] border border-line bg-gradient-to-b from-surface to-bg-raised p-6"
            >
              <span className="font-mono text-[13px] text-frost">{step.n}</span>
              <span className="font-display text-[21px] font-bold text-ink">{step.title}</span>
              <span className="text-[15px] leading-relaxed text-ink-2">{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------- Features */}
      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-8 sm:py-20">
        <h2 className="mb-9 font-display text-[clamp(1.75rem,3.4vw,2.75rem)] leading-tight font-bold tracking-[-0.01em] text-balance text-ink">
          Everything a serious practice platform needs.
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="tilt panel flex min-h-[200px] flex-col gap-3.5 rounded-[22px] p-7">
              <span
                className="grid size-11 place-items-center rounded-xl bg-ember/12 font-mono text-lg text-ember"
                aria-hidden="true"
              >
                {feature.mark}
              </span>
              <h3 className="font-display text-[19px] font-bold text-ink">{feature.title}</h3>
              <p className="text-[15px] leading-relaxed text-ink-2">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------- Contest band */}
      <section className="mx-auto max-w-[1240px] px-4 pt-6 pb-24 sm:px-8 sm:pb-28">
        <div className="relative flex flex-wrap items-center justify-between gap-7 overflow-hidden rounded-[28px] border border-line-strong bg-surface px-6 py-10 sm:px-12 sm:py-14">
          <div
            className="pointer-events-none absolute -top-32 -right-20 size-[380px] rounded-full bg-[radial-gradient(circle,var(--glow),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="relative min-w-0 flex-[1_1_420px]">
            {contest && (
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line-strong bg-bg-raised px-3 py-1 font-mono text-[12px] text-ink-2">
                <span
                  className={`size-2 rounded-full ${contest.state === "Running" ? "bg-pass" : "bg-frost"}`}
                  aria-hidden="true"
                />
                {contest.state === "Running" ? "Live now" : "Up next"}: {contest.title} · {contest.problem_count} problems
              </p>
            )}
            <h2 className="font-display text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.06] font-extrabold text-ink">
              Timed contests.
              <br />
              Standings that count.
            </h2>
            <p className="mt-4 max-w-[32rem] text-[17px] leading-relaxed text-ink-2">
              ICPC-style rounds: a point for each problem on first solve, a penalty for time and wrong attempts. Practice
              submissions never touch the standings.
            </p>
          </div>
          <Link
            to="/contests"
            className="btn-primary relative rounded-2xl px-6 py-4 text-[16px] font-semibold sm:text-[17px]"
          >
            {contest?.state === "Running" ? "Join the live contest" : "See the contests"}
          </Link>
        </div>
      </section>
    </div>
  );
}

function HeroStat({ label, value, failed = false }: { label: string; value: number | null; failed?: boolean }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="font-mono text-[13px] text-ink-2">{label}</dt>
      <dd className="font-display text-[26px] font-semibold text-ink tabular-nums">
        {value ?? (failed ? "—" : <span className="skeleton inline-block h-7 w-14 align-middle" />)}
      </dd>
    </div>
  );
}
