import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Health } from "../lib/types";
import { Badge, Card } from "../components/ui";

const FEATURES = [
  {
    icon: "◈",
    title: "Container-isolated execution",
    body: "Every submission runs in a throw-away sandbox: network disabled, hard memory ceiling, CPU quota, process cap, read-only root filesystem and every Linux capability dropped.",
  },
  {
    icon: "◉",
    title: "Seven distinct verdicts",
    body: "Accepted, Wrong Answer, Time Limit Exceeded, Memory Limit Exceeded, Runtime Error, Compilation Error and Output Limit Exceeded — each from a real signal, not a guess.",
  },
  {
    icon: "◐",
    title: "Sample and hidden suites",
    body: "Samples run first so a wrong solution fails in one execution. Hidden test data never leaves the server — only its index and timings ever reach a response.",
  },
  {
    icon: "◆",
    title: "Contests with ICPC scoring",
    body: "Points awarded once per problem on first solve, with time-plus-attempt penalties. Practice submissions can never move a contest ranking.",
  },
  {
    icon: "◍",
    title: "Real measurements",
    body: "Execution time and peak memory are sampled from the sandbox itself, not hard-coded. Numbers you can sort and compare.",
  },
  {
    icon: "◇",
    title: "Analytics that add up",
    body: "Acceptance rate, distinct problems solved, verdict distribution and per-language breakdowns — all computed with grouped SQL aggregates.",
  },
];

const SAMPLE_CODE = `a, b = map(int, input().split())
print(a + b)`;

export function Landing() {
  const { user } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [problemCount, setProblemCount] = useState<number | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api
      .problems({ limit: 1 })
      .then((page) => setProblemCount(page.total))
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* ---------------------------------------------------------- Hero */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-rise mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-violet-200/80 backdrop-blur-xl">
              <span
                className="size-1.5 rounded-full bg-emerald-400 animate-pulse-ring"
                aria-hidden="true"
              />
              {health
                ? `Judge online · ${health.execution.active} sandbox`
                : "Connecting to the judge…"}
            </span>
          </div>

          <h1
            className="animate-rise text-5xl font-black tracking-tight text-balance sm:text-7xl"
            style={{ animationDelay: "60ms" }}
          >
            <span className="gradient-text">Write code.</span>
            <br />
            <span className="text-violet-50">Get judged.</span>
          </h1>

          <p
            className="animate-rise mx-auto mt-6 max-w-xl text-lg text-pretty text-violet-200/65"
            style={{ animationDelay: "120ms" }}
          >
            A competitive-programming judge that compiles and runs untrusted
            code in a locked-down sandbox, then grades it against sample and
            hidden test suites — in one request.
          </p>

          <div
            className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "180ms" }}
          >
            <Link
              to={user ? "/problems" : "/register"}
              className="btn-primary rounded-xl px-6 py-3 text-sm font-semibold text-white"
            >
              {user ? "Solve a problem" : "Start solving — free"}
            </Link>
            <Link
              to="/problems"
              className="btn-ghost rounded-xl px-6 py-3 text-sm font-semibold text-violet-100"
            >
              Browse problems →
            </Link>
          </div>

          {!user && (
            <p
              className="animate-rise mt-5 text-xs text-violet-200/45"
              style={{ animationDelay: "220ms" }}
            >
              Or try the demo account —{" "}
              <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-violet-200/80">
                demo@example.com
              </code>{" "}
              /{" "}
              <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-violet-200/80">
                DemoPass123
              </code>
            </p>
          )}
        </div>

        {/* Editor mock — shows the product before asking for a signup. */}
        <div
          className="animate-rise mx-auto mt-16 max-w-4xl"
          style={{ animationDelay: "260ms" }}
        >
          <Card solid edge className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
              <span className="size-3 rounded-full bg-rose-400/70" />
              <span className="size-3 rounded-full bg-amber-400/70" />
              <span className="size-3 rounded-full bg-emerald-400/70" />
              <span className="ml-3 font-mono text-xs text-violet-200/50">
                solution.py — Sum of Two Numbers
              </span>
            </div>

            <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
              <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-relaxed text-violet-100/90">
                <code>
                  <span className="text-violet-200/30">1  </span>
                  <span className="text-sky-300">a</span>,{" "}
                  <span className="text-sky-300">b</span> ={" "}
                  <span className="text-fuchsia-300">map</span>(
                  <span className="text-emerald-300">int</span>,{" "}
                  <span className="text-fuchsia-300">input</span>().
                  <span className="text-fuchsia-300">split</span>()){"\n"}
                  <span className="text-violet-200/30">2  </span>
                  <span className="text-fuchsia-300">print</span>(a + b)
                </code>
              </pre>

              <div className="border-t border-white/8 p-5 md:border-t-0 md:border-l">
                <div className="mb-4 flex items-center gap-2">
                  <Badge tone="pass">✓ Accepted</Badge>
                </div>
                <dl className="space-y-2.5 font-mono text-sm">
                  {[
                    ["Tests", "6 / 6"],
                    ["Time", "63.1 ms"],
                    ["Memory", "9.0 MB"],
                    ["Score", "100"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt className="text-violet-200/50">{label}</dt>
                      <dd className="tabular-nums text-violet-50">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* --------------------------------------------------------- Stats */}
      <section className="grid grid-cols-2 gap-4 pb-20 lg:grid-cols-4">
        {[
          { label: "Problems", value: problemCount ?? "—" },
          { label: "Languages", value: health?.languages.length ?? 3 },
          { label: "Verdicts", value: 7 },
          {
            label: "Database",
            value: health?.database.connected ? "Online" : "—",
          },
        ].map((stat, index) => (
          <Card
            key={stat.label}
            hover
            edge
            className="animate-rise p-5 text-center"
            {...{ style: { animationDelay: `${index * 60}ms` } }}
          >
            <p className="font-mono text-3xl font-bold tabular-nums text-violet-50">
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] font-semibold tracking-[0.14em] text-violet-300/60 uppercase">
              {stat.label}
            </p>
          </Card>
        ))}
      </section>

      {/* ------------------------------------------------------ Features */}
      <section className="pb-24">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-violet-300/70 uppercase">
            How it works
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-violet-50 sm:text-4xl">
            Running a stranger&rsquo;s code, safely
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-violet-200/60">
            Everything here follows from one problem: execute code you
            don&rsquo;t trust, on your server, and return a verdict you can
            rely on.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Card
              key={feature.title}
              hover
              edge
              className="animate-rise p-6"
              {...{ style: { animationDelay: `${index * 50}ms` } }}
            >
              <div
                className="mb-4 grid size-11 place-items-center rounded-xl border border-white/12 bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 text-lg text-violet-200"
                aria-hidden="true"
              >
                {feature.icon}
              </div>
              <h3 className="mb-2 text-base font-semibold text-violet-50">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-violet-200/60">
                {feature.body}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------- Honesty */}
      {health && (
        <section className="pb-24">
          <Card solid className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-xl">
                <h3 className="mb-2 text-lg font-semibold text-violet-50">
                  What this instance is actually running
                </h3>
                <p className="text-sm leading-relaxed text-violet-200/60">
                  Free hosting exposes no Docker socket, so this deployment
                  uses the resource-limited subprocess sandbox rather than
                  containers. The endpoint below always reports the truth — the
                  judge never claims isolation it is not providing.
                </p>
              </div>

              <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-3 font-mono text-sm">
                <dt className="text-violet-200/50">Sandbox</dt>
                <dd className="text-violet-50">{health.execution.active}</dd>
                <dt className="text-violet-200/50">Database</dt>
                <dd className="text-violet-50">
                  {health.database.dialect ?? "—"}
                </dd>
                <dt className="text-violet-200/50">Environment</dt>
                <dd className="text-violet-50">{health.environment}</dd>
                {health.execution.toolchains && (
                  <>
                    <dt className="text-violet-200/50">Toolchains</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {Object.entries(health.execution.toolchains).map(
                        ([lang, ok]) => (
                          <Badge key={lang} tone={ok ? "pass" : "muted"}>
                            {ok ? "✓" : "✕"} {lang}
                          </Badge>
                        ),
                      )}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </Card>
        </section>
      )}

      {/* ------------------------------------------------------------ CTA */}
      <section className="pb-24">
        <Card edge className="overflow-hidden p-10 text-center sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight text-violet-50 sm:text-4xl">
            Ready to solve something?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty text-violet-200/60">
            Six problems from Easy to Hard, a live contest, and instant
            verdicts. No setup.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={user ? "/problems" : "/register"}
              className="btn-primary rounded-xl px-6 py-3 text-sm font-semibold text-white"
            >
              {user ? "Go to problems" : "Create an account"}
            </Link>
            <Link
              to="/contests"
              className="btn-ghost rounded-xl px-6 py-3 text-sm font-semibold text-violet-100"
            >
              See the contest
            </Link>
          </div>
          <pre className="mx-auto mt-10 w-fit rounded-xl border border-white/10 bg-black/30 px-5 py-3 text-left font-mono text-xs text-violet-200/70">
            {SAMPLE_CODE}
          </pre>
        </Card>
      </section>
    </div>
  );
}
