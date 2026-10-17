import { useMemo, type CSSProperties } from "react";
import { formatMemory, verdictTone } from "../../lib/format";
import type { RunResult, Submission, TestCaseResult } from "../../lib/types";
import { Badge } from "../ui";

const TONE_CARD = {
  pass: "border-pass/35 bg-pass/8",
  fail: "border-fail/35 bg-fail/8",
  warn: "border-warn/35 bg-warn/8",
  info: "border-info/35 bg-info/8",
  muted: "border-line bg-surface-2",
} as const;

const TONE_TEXT = {
  pass: "text-pass",
  fail: "text-fail",
  warn: "text-warn",
  info: "text-info",
  muted: "text-ink-2",
} as const;

/* ------------------------------------------------------------ judging */

export function JudgingState({ mode }: { mode: "run" | "submit" }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-2.5 animate-bounce rounded-full bg-ember"
            style={{ animationDelay: `${index * 140}ms` }}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-ink">
        {mode === "submit" ? "Judging against every test case…" : "Running your code…"}
      </p>
      <p className="max-w-xs text-xs text-ink-3">
        Code executes in a sandbox with hard time and memory limits.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- verdict */

export function SubmissionResult({
  submission,
  celebrate = false,
}: {
  submission: Submission;
  /** Fresh results get the reveal and, when Accepted, the sparks. */
  celebrate?: boolean;
}) {
  const { tone, icon } = verdictTone(submission.verdict);
  const accepted = submission.verdict === "Accepted";
  const failedAt = submission.failed_test_index;

  return (
    <div className="space-y-4">
      <section
        aria-label="Verdict"
        className={[
          "relative rounded-2xl border p-4 sm:p-5",
          TONE_CARD[tone],
          celebrate ? "animate-verdict" : "",
          celebrate && accepted ? "solve-glow" : "",
        ].join(" ")}
      >
        {celebrate && accepted && <Sparks />}

        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className={`flex items-center gap-2.5 font-display text-xl font-bold sm:text-2xl ${TONE_TEXT[tone]}`}>
              <span aria-hidden="true" className="text-[0.8em]">
                {icon}
              </span>
              {submission.verdict}
            </p>
            <p className="mt-1 font-mono text-[13px] text-ink-2">
              {submission.passed_tests} / {submission.total_tests} tests passed
              {failedAt != null && <> · first failure on test {failedAt}</>}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 font-mono">
            <Figure label="runtime" value={`${formatMs(submission.execution_time_ms)}`} />
            <Figure label="memory" value={formatMemory(submission.memory_kb)} />
            <Figure label="score" value={String(submission.score)} />
          </dl>
        </div>

        <TestDots submission={submission} animate={celebrate} />
      </section>

      {submission.error_message && (
        <div>
          <Label>Details</Label>
          <pre className="max-h-56 overflow-auto rounded-xl border border-fail/25 bg-fail/6 p-3.5 font-mono text-xs whitespace-pre-wrap text-ink">
            {submission.error_message}
          </pre>
        </div>
      )}

      {submission.test_results && submission.test_results.length > 0 && (
        <div>
          <Label>Per-test breakdown</Label>
          <ul className="space-y-1.5">
            {submission.test_results.map((test) => (
              <TestRow key={test.index} test={test} />
            ))}
          </ul>
          <p className="mt-2.5 text-xs text-ink-3">
            Hidden test inputs and expected outputs never leave the server.
          </p>
        </div>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[11px] tracking-wide text-ink-3">{label}</dt>
      <dd className="text-base font-medium text-ink tabular-nums sm:text-lg">{value}</dd>
    </div>
  );
}

/**
 * One square per test. A fresh submission carries the exact breakdown; an
 * older one only has counts, so the squares are inferred: everything before
 * the first failure passed, and the judge stops there.
 */
function TestDots({ submission, animate }: { submission: Submission; animate: boolean }) {
  const dots = useMemo(() => {
    const total = Math.min(submission.total_tests, 120);
    if (submission.test_results?.length) {
      // The judge stops at the first failure; the tests after it never ran.
      const ran = submission.test_results.slice(0, 120).map((test) => (test.passed ? "pass" : "fail"));
      return [...ran, ...Array.from({ length: Math.max(0, total - ran.length) }, () => "skip")];
    }
    const failed = submission.failed_test_index;
    return Array.from({ length: total }, (_, index) => {
      if (failed != null) return index + 1 < failed ? "pass" : index + 1 === failed ? "fail" : "skip";
      return index < submission.passed_tests ? "pass" : "skip";
    });
  }, [submission]);

  if (dots.length === 0) return null;
  const passed = dots.filter((dot) => dot === "pass").length;

  return (
    <div
      role="img"
      aria-label={`${passed} of ${dots.length} tests passed`}
      className="mt-4 flex flex-wrap gap-1"
    >
      {dots.map((dot, index) => (
        <span
          key={index}
          className={[
            "size-3 rounded-[4px]",
            dot === "pass" ? "bg-pass/85" : dot === "fail" ? "bg-fail" : "bg-ink-3/25",
            animate ? "solve-dot" : "",
          ].join(" ")}
          style={animate ? { animationDelay: `${120 + Math.min(index, 60) * 18}ms` } : undefined}
        />
      ))}
    </div>
  );
}

const SPARK_COLOURS = ["var(--ember)", "var(--frost)", "var(--pass)", "var(--warn)", "var(--ember-2)"];

/** A ring of CSS sparks thrown from the verdict title. No library, no canvas. */
function Sparks() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => {
        const angle = (index / 22) * Math.PI * 2;
        const distance = 70 + (index % 4) * 24;
        return {
          "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
          "--dy": `${Math.round(Math.sin(angle) * distance * 0.7)}px`,
          "--r": `${index * 47}deg`,
          "--x": "5.5rem",
          background: SPARK_COLOURS[index % SPARK_COLOURS.length],
          animationDelay: `${0.12 + (index % 3) * 0.05}s`,
        } as CSSProperties;
      }),
    [],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {sparks.map((style, index) => (
        <span key={index} className="solve-spark" style={style} />
      ))}
    </div>
  );
}

function TestRow({ test }: { test: TestCaseResult }) {
  const hasDetail = test.is_sample && (test.expected_output != null || test.actual_output != null);
  const head = (
    <>
      <span
        className={[
          "grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-bold",
          test.passed ? "bg-pass/15 text-pass" : "bg-fail/15 text-fail",
        ].join(" ")}
        aria-hidden="true"
      >
        {test.passed ? "✓" : "✕"}
      </span>
      <span className="text-sm text-ink">Test {test.index}</span>
      <Badge tone={test.is_sample ? "info" : "muted"}>{test.is_sample ? "sample" : "hidden"}</Badge>
      {!test.passed && <span className="truncate text-xs font-medium text-fail">{test.verdict}</span>}
      <span className="ml-auto shrink-0 font-mono text-xs text-ink-3 tabular-nums">
        {formatMs(test.execution_time_ms)}
        <span className="hidden sm:inline"> · {formatMemory(test.memory_kb)}</span>
      </span>
    </>
  );

  if (!hasDetail) {
    return (
      <li className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/50 px-3 py-2">{head}</li>
    );
  }

  return (
    <li className="rounded-xl border border-line bg-surface-2/50">
      <details open={!test.passed} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl px-3 py-2 [&::-webkit-details-marker]:hidden">
          {head}
          <span aria-hidden="true" className="text-xs text-ink-3 transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        {/* Only sample cases carry data; hidden data never leaves the server. */}
        <div className="grid gap-2 border-t border-line p-3 sm:grid-cols-2">
          {test.input_data != null && (
            <div className="sm:col-span-2">
              <Block label="Input" body={test.input_data} />
            </div>
          )}
          <Block label="Expected" body={test.expected_output ?? ""} tone="pass" />
          <Block label="Your output" body={test.actual_output ?? ""} tone={test.passed ? "pass" : "fail"} />
          {test.stderr && (
            <div className="sm:col-span-2">
              <Block label="stderr" body={test.stderr} tone="fail" />
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

/* ----------------------------------------------------------------- run */

export function RunOutput({
  result,
  expected,
}: {
  result: RunResult;
  /** When the input was a sample, its expected output, to compare against. */
  expected?: { label: string; output: string } | null;
}) {
  const ok = result.outcome === "ok";
  const matches = expected != null && ok ? sameOutput(result.stdout, expected.output) : null;

  return (
    <div className="animate-verdict space-y-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone={ok ? "pass" : "fail"}>
          <span aria-hidden="true">{ok ? "✓" : "✕"}</span>
          {ok ? "Ran" : result.outcome.replace(/_/g, " ")}
        </Badge>
        {matches != null && expected && (
          <Badge tone={matches ? "pass" : "warn"}>
            {matches ? `Matches ${expected.label}` : `Differs from ${expected.label}`}
          </Badge>
        )}
        <span className="font-mono text-xs text-ink-3 tabular-nums">
          {formatMs(result.execution_time_ms)} · {formatMemory(result.memory_kb)} · exit {result.exit_code}
        </span>
      </div>

      {expected != null && ok ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Block label="Your output" body={result.stdout || "(no output)"} tone={matches ? "pass" : "fail"} />
          <Block label={`Expected (${expected.label})`} body={expected.output} tone="pass" />
        </div>
      ) : (
        <Block label="stdout" body={result.stdout || "(no output)"} />
      )}
      {result.stderr && <Block label="stderr" body={result.stderr} tone="fail" />}
      {result.compile_output && <Block label="compiler" body={result.compile_output} tone="fail" />}
    </div>
  );
}

/** Judges compare tokens line by line; trailing whitespace never matters. */
function sameOutput(actual: string, expected: string) {
  const norm = (text: string) =>
    text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  return norm(actual) === norm(expected);
}

/* ------------------------------------------------------------- helpers */

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(ms < 10 ? 1 : 0)} ms`;
}

function Label({ children }: { children: string }) {
  return <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.14em] text-ink-3 uppercase">{children}</p>;
}

function Block({ label, body, tone }: { label: string; body: string; tone?: "pass" | "fail" }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 font-mono text-[10.5px] tracking-[0.12em] text-ink-3 uppercase">{label}</p>
      <pre
        className={[
          "max-h-48 overflow-auto rounded-lg border bg-bg-raised p-2.5 font-mono text-xs whitespace-pre-wrap text-ink",
          tone === "pass" ? "border-pass/25" : tone === "fail" ? "border-fail/30" : "border-line",
        ].join(" ")}
      >
        {body || "(empty)"}
      </pre>
    </div>
  );
}
