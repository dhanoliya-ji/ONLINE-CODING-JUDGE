import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Group, Panel, Separator, useDefaultLayout, type LayoutStorage } from "react-resizable-panels";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LANGUAGE_LABELS } from "../lib/format";
import type { LanguageId, Problem, RunResult, Submission, TestCasePublic } from "../lib/types";
import { CoachPanel } from "../components/CoachPanel";
import { CodeEditor } from "../components/CodeEditor";
import { Markdown } from "../components/Markdown";
import { STARTERS } from "../components/solve/starters";
import { SubmissionsTab } from "../components/solve/SubmissionsTab";
import { useMediaQuery } from "../components/solve/useMediaQuery";
import { JudgingState, RunOutput, SubmissionResult } from "../components/solve/Verdict";
import { Alert, Badge, Button, DifficultyBadge, Skeleton } from "../components/ui";
import "../components/solve/solve.css";

const LANGUAGES: LanguageId[] = ["python", "c", "cpp", "java", "javascript", "typescript", "go", "rust", "ruby", "php"];

const FILE_NAMES: Record<LanguageId, string> = {
  python: "solution.py",
  c: "solution.c",
  cpp: "solution.cpp",
  java: "Main.java",
  javascript: "solution.js",
  typescript: "solution.ts",
  go: "main.go",
  rust: "main.rs",
  ruby: "solution.rb",
  php: "solution.php",
};

const draftKey = (slug: string, language: string) => `crucible.draft.${slug}.${language}`;

function readDraft(slug: string, language: LanguageId): string {
  try {
    return localStorage.getItem(draftKey(slug, language)) ?? STARTERS[language];
  } catch {
    return STARTERS[language];
  }
}

// Pane sizes are remembered, but private windows can refuse storage outright.
const layoutStorage: LayoutStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not remembered; the default split is used next time.
    }
  },
};

type Example = { input: string; output: string };

export function Solve() {
  const { slug = "" } = useParams();
  // Keyed by problem: moving to another one starts a clean workspace.
  return <Workspace key={slug} slug={slug} />;
}

function Workspace({ slug }: { slug: string }) {
  const { user } = useAuth();
  const wide = useMediaQuery("(min-width: 900px)");

  const [problem, setProblem] = useState<Problem | null>(null);
  const [samples, setSamples] = useState<TestCasePublic[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [language, setLanguage] = useState<LanguageId>("python");
  const [code, setCode] = useState(() => readDraft(slug, "python"));
  const [stdin, setStdin] = useState("");

  const [result, setResult] = useState<Submission | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runExpected, setRunExpected] = useState<{ label: string; output: string } | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [celebrateId, setCelebrateId] = useState<number | null>(null);
  const [submitCount, setSubmitCount] = useState(0);

  const [leftTab, setLeftTab] = useState<"description" | "submissions">("description");
  const [consoleTab, setConsoleTab] = useState<"input" | "result">("input");
  const [mobileView, setMobileView] = useState<"problem" | "code">("problem");

  useEffect(() => {
    let live = true;
    api
      .problem(slug)
      .then(async (found) => {
        if (!live) return;
        setProblem(found);
        setStdin(found.sample_input);
        try {
          const cases = await api.testCases(found.id);
          if (live) setSamples(cases.filter((testCase) => testCase.is_sample));
        } catch {
          // The statement's own sample still works as an example.
        }
      })
      .catch((error: Error) => live && setLoadError(error.message));
    return () => {
      live = false;
    };
  }, [slug]);

  // The sparks and reveal play once, not every time the Result tab reopens.
  useEffect(() => {
    if (celebrateId == null) return;
    const timer = setTimeout(() => setCelebrateId(null), 2400);
    return () => clearTimeout(timer);
  }, [celebrateId]);

  const examples: Example[] = useMemo(() => {
    if (samples.length > 0) {
      return samples.map((sample) => ({ input: sample.input_data ?? "", output: sample.expected_output ?? "" }));
    }
    if (problem && (problem.sample_input || problem.sample_output)) {
      return [{ input: problem.sample_input, output: problem.sample_output }];
    }
    return [];
  }, [samples, problem]);

  function editCode(next: string) {
    setCode(next);
    try {
      localStorage.setItem(draftKey(slug, language), next);
    } catch {
      // Storage full or refused: the draft lives only in memory.
    }
  }

  function changeLanguage(next: LanguageId) {
    setLanguage(next);
    setCode(readDraft(slug, next));
  }

  function openInEditor(nextLanguage: LanguageId, source: string) {
    setLanguage(nextLanguage);
    setCode(source);
    try {
      localStorage.setItem(draftKey(slug, nextLanguage), source);
    } catch {
      // As above: kept in memory only.
    }
    setMobileView("code");
  }

  function loadExample(index: number) {
    setStdin(examples[index].input);
    setConsoleTab("input");
    setMobileView("code");
  }

  async function handleRun() {
    if (!problem || !user || busy) return;
    setBusy("run");
    setActionError(null);
    setResult(null);
    setConsoleTab("result");
    setMobileView("code");
    const index = examples.findIndex((example) => sameText(example.input, stdin));
    setRunExpected(index >= 0 ? { label: `sample ${index + 1}`, output: examples[index].output } : null);
    try {
      setRunResult(await api.run({ language, source_code: code, stdin, problem_id: problem.id }));
    } catch (error) {
      setRunResult(null);
      setActionError(error instanceof Error ? error.message : "Run failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    if (!problem || !user || busy) return;
    setBusy("submit");
    setActionError(null);
    setRunResult(null);
    setConsoleTab("result");
    setMobileView("code");
    try {
      const submission = await api.submit({ problem_id: problem.id, language, source_code: code });
      setResult(submission);
      setCelebrateId(submission.id);
      setSubmitCount((count) => count + 1);
      if (submission.verdict === "Accepted") {
        setProblem((current) => current && { ...current, solved_by_me: true });
      }
    } catch (error) {
      setResult(null);
      setActionError(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setBusy(null);
    }
  }

  // Ctrl+' runs and Ctrl+Enter submits from anywhere, the editor included.
  // Capture phase, so CodeMirror's own Mod-Enter binding never sees it.
  const actions = useRef({ run: handleRun, submit: handleSubmit });
  useEffect(() => {
    actions.current = { run: handleRun, submit: handleSubmit };
  });
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        void actions.current.submit();
      } else if (event.key === "'" || event.code === "Quote") {
        event.preventDefault();
        event.stopPropagation();
        void actions.current.run();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const outer = useDefaultLayout({ id: "crucible.solve.split", storage: layoutStorage });
  const inner = useDefaultLayout({ id: "crucible.solve.editor", storage: layoutStorage });

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <Alert>{loadError}</Alert>
        <Link to="/problems" className="mt-4 inline-block text-sm text-ember hover:text-ember-2">
          ← Back to problems
        </Link>
      </div>
    );
  }

  if (!problem) return <LoadingWorkspace />;

  const signedIn = user != null;

  /* ------------------------------------------------------------ panes */

  const problemPane = (fill: boolean) => (
    <section
      aria-label="Problem"
      className={`panel flex min-h-0 flex-col overflow-hidden ${fill ? "h-full" : ""}`}
    >
      <Tabs
        label="Problem views"
        idBase="problem"
        value={leftTab}
        onChange={setLeftTab}
        items={[
          { id: "description", label: "Description" },
          { id: "submissions", label: "Submissions" },
        ]}
      />
      <div
        role="tabpanel"
        id={`problem-panel-${leftTab}`}
        aria-labelledby={`problem-tab-${leftTab}`}
        className={fill ? "min-h-0 flex-1 overflow-y-auto" : ""}
      >
        {leftTab === "description" ? (
          <Description problem={problem} examples={examples} onUseExample={loadExample} />
        ) : (
          <SubmissionsTab
            problemId={problem.id}
            slug={slug}
            signedIn={signedIn}
            refreshKey={submitCount}
            onOpenInEditor={openInEditor}
          />
        )}
      </div>
    </section>
  );

  const editorPane = (fill: boolean) => (
    <section
      aria-label="Code editor"
      className={`panel flex min-h-0 flex-col overflow-hidden ${fill ? "h-full" : "h-[58dvh] min-h-80"}`}
    >
      <div className="flex min-h-10 items-center gap-2.5 border-b border-line px-3.5 text-xs">
        <span className="font-mono text-ink">{FILE_NAMES[language]}</span>
        <span className="hidden text-ink-3 sm:inline">· draft saved in this browser</span>
        <button
          onClick={() => editCode(STARTERS[language])}
          className="ml-auto min-h-8 rounded-lg px-2.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Reset to starter
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor value={code} onChange={editCode} language={language} height="100%" />
      </div>
    </section>
  );

  const consolePane = (fill: boolean) => (
    <section
      aria-label="Console"
      className={`panel flex min-h-0 flex-col overflow-hidden ${fill ? "h-full" : "min-h-72"}`}
    >
      <Tabs
        label="Console views"
        idBase="console"
        value={consoleTab}
        onChange={setConsoleTab}
        items={[
          { id: "input", label: "Test input" },
          {
            id: "result",
            label: "Result",
            dot: busy ? "busy" : result ? (result.verdict === "Accepted" ? "pass" : "fail") : runResult ? "info" : undefined,
          },
        ]}
      />
      <div className={`relative p-4 ${fill ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
        <div
          role="tabpanel"
          id="console-panel-input"
          aria-labelledby="console-tab-input"
          hidden={consoleTab !== "input"}
          className="h-full"
        >
          <TestInput examples={examples} stdin={stdin} onChange={setStdin} />
        </div>
        <div
          role="tabpanel"
          id="console-panel-result"
          aria-labelledby="console-tab-result"
          hidden={consoleTab !== "result"}
          aria-live="polite"
          aria-busy={busy != null}
        >
          {actionError ? (
            <Alert>{actionError}</Alert>
          ) : busy ? (
            <JudgingState mode={busy} />
          ) : result ? (
            <SubmissionResult submission={result} celebrate={celebrateId === result.id} />
          ) : runResult ? (
            <RunOutput result={runResult} expected={runExpected} />
          ) : (
            <IdleConsole signedIn={signedIn} slug={slug} />
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="flex flex-col min-[900px]:h-[calc(100dvh-3.75rem)]">
      <HeaderBar
        problem={problem}
        language={language}
        onLanguage={changeLanguage}
        busy={busy}
        signedIn={signedIn}
        onRun={handleRun}
        onSubmit={handleSubmit}
        coach={
          <CoachPanel
            key={problem.slug}
            slug={problem.slug}
            code={code}
            language={language}
            verdict={lastVerdict(result, runResult)}
            variant="inline"
          />
        }
      />

      {wide ? (
        <div className="min-h-0 flex-1 px-2.5 pb-2.5">
          <Group
            orientation="horizontal"
            defaultLayout={outer.defaultLayout}
            onLayoutChanged={outer.onLayoutChanged}
          >
            <Panel id="problem" defaultSize="44" minSize="24">
              {problemPane(true)}
            </Panel>
            <SplitHandle orientation="horizontal" />
            <Panel id="work" defaultSize="56" minSize="32">
              <Group
                orientation="vertical"
                defaultLayout={inner.defaultLayout}
                onLayoutChanged={inner.onLayoutChanged}
              >
                <Panel id="editor" defaultSize="62" minSize="22">
                  {editorPane(true)}
                </Panel>
                <SplitHandle orientation="vertical" />
                <Panel id="console" defaultSize="38" minSize="14">
                  {consolePane(true)}
                </Panel>
              </Group>
            </Panel>
          </Group>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-8">
          <div
            role="group"
            aria-label="Show"
            className="sticky top-[3.75rem] z-20 -mx-4 grid grid-cols-2 gap-1 border-b border-line bg-bg/85 px-4 py-2 backdrop-blur-xl"
          >
            {(["problem", "code"] as const).map((view) => (
              <button
                key={view}
                aria-pressed={mobileView === view}
                onClick={() => setMobileView(view)}
                className={[
                  "min-h-10 rounded-xl text-sm font-medium transition-colors",
                  mobileView === view ? "bg-surface-3 text-ink shadow-sm" : "text-ink-2 hover:bg-surface-2",
                ].join(" ")}
              >
                {view === "problem" ? "Problem" : "Code"}
              </button>
            ))}
          </div>
          {mobileView === "problem" ? (
            problemPane(false)
          ) : (
            <>
              {editorPane(false)}
              {consolePane(false)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** What the student last saw, in words the coach can reason about. */
function lastVerdict(result: Submission | null, run: RunResult | null): string | null {
  if (result) {
    const where = result.failed_test_index != null ? ` on test ${result.failed_test_index}` : "";
    const detail = result.error_message ? `: ${result.error_message}` : "";
    return `Submitted: ${result.verdict}${where} (${result.passed_tests}/${result.total_tests} passed)${detail}`.slice(0, 200);
  }
  if (run) {
    const detail = run.compile_output || run.stderr;
    return `Ran on custom input: ${run.outcome}${detail ? `: ${detail}` : ""}`.slice(0, 200);
  }
  return null;
}

function sameText(a: string, b: string) {
  return a.replace(/\r\n/g, "\n").trim() === b.replace(/\r\n/g, "\n").trim();
}

function formatLimit(ms: number) {
  return ms % 1000 === 0 ? `${ms / 1000} s` : `${ms} ms`;
}

/* ------------------------------------------------------------- header */

function HeaderBar({
  problem,
  language,
  onLanguage,
  busy,
  signedIn,
  onRun,
  onSubmit,
  coach,
}: {
  problem: Problem;
  language: LanguageId;
  onLanguage: (language: LanguageId) => void;
  busy: "run" | "submit" | null;
  signedIn: boolean;
  onRun: () => void;
  onSubmit: () => void;
  coach: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 min-[900px]:px-3.5 min-[900px]:py-2.5">
      <Link
        to="/problems"
        aria-label="Back to problems"
        title="Back to problems"
        className="btn-ghost grid size-9 shrink-0 place-items-center rounded-xl text-ink-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="min-w-0 truncate font-display text-[15px] font-bold tracking-tight text-ink sm:text-base">
          {problem.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={problem.difficulty} />
          {problem.solved_by_me && (
            <Badge tone="pass">
              <span aria-hidden="true">✓</span> Solved
            </Badge>
          )}
          <span className="font-mono text-xs text-ink-3" title="Time and memory limits">
            {formatLimit(problem.time_limit_ms)} · {problem.memory_limit_mb} MB
          </span>
        </div>
      </div>

      <div className="flex w-full items-center gap-2 min-[900px]:w-auto">
        {coach}
        <label htmlFor="language" className="sr-only">
          Language
        </label>
        <select
          id="language"
          value={language}
          onChange={(event) => onLanguage(event.target.value as LanguageId)}
          className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink transition-colors hover:border-line-strong min-[900px]:flex-none"
        >
          {LANGUAGES.map((id) => (
            <option key={id} value={id}>
              {LANGUAGE_LABELS[id]}
            </option>
          ))}
        </select>

        {signedIn ? (
          <>
            <Button variant="ghost" onClick={onRun} loading={busy === "run"} disabled={busy !== null} className="min-h-9! px-3.5!">
              {busy !== "run" && <span aria-hidden="true">▷</span>}
              Run
              <Shortcut keys="Ctrl '" />
            </Button>
            <Button onClick={onSubmit} loading={busy === "submit"} disabled={busy !== null} className="min-h-9! px-4!">
              Submit
              <Shortcut keys="Ctrl ↵" />
            </Button>
          </>
        ) : (
          <Link
            to="/login"
            state={{ from: `/problems/${problem.slug}` }}
            className="btn-primary inline-flex min-h-9 items-center rounded-xl px-4 text-sm font-semibold whitespace-nowrap"
          >
            Sign in to submit
          </Link>
        )}
      </div>
    </div>
  );
}

/** Keyboard hint inside a button; touch screens have no keyboard to hint at. */
function Shortcut({ keys }: { keys: string }) {
  return (
    <kbd className="ml-0.5 hidden rounded-md border border-current/25 px-1.5 font-mono text-[10.5px] leading-[1.15rem] font-medium opacity-70 min-[900px]:inline">
      {keys}
    </kbd>
  );
}

/* --------------------------------------------------------------- tabs */

function Tabs<T extends string>({
  label,
  idBase,
  value,
  onChange,
  items,
}: {
  label: string;
  idBase: string;
  value: T;
  onChange: (value: T) => void;
  items: { id: T; label: string; dot?: "busy" | "pass" | "fail" | "info" }[];
}) {
  // Arrow keys move between tabs, as the ARIA tabs pattern expects.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = items.findIndex((item) => item.id === value);
    const next = items[(index + (event.key === "ArrowRight" ? 1 : items.length - 1)) % items.length];
    onChange(next.id);
    document.getElementById(`${idBase}-tab-${next.id}`)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex shrink-0 gap-1 border-b border-line px-2.5">
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            id={`${idBase}-tab-${item.id}`}
            role="tab"
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={[
              "relative -mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
              selected ? "border-ember text-ink" : "border-transparent text-ink-3 hover:text-ink-2",
            ].join(" ")}
          >
            {item.label}
            {item.dot && (
              <span
                aria-hidden="true"
                className={[
                  "size-1.5 rounded-full",
                  item.dot === "busy"
                    ? "animate-pulse bg-ember"
                    : item.dot === "pass"
                      ? "bg-pass"
                      : item.dot === "fail"
                        ? "bg-fail"
                        : "bg-info",
                ].join(" ")}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function SplitHandle({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const across = orientation === "horizontal";
  return (
    <Separator
      className={[
        "group flex items-center justify-center rounded-full outline-none",
        across ? "w-2.5" : "h-2.5",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "rounded-full bg-line-strong transition-colors",
          "group-data-[separator=hover]:bg-ember/60 group-data-[separator=focus]:bg-ember group-data-[separator=active]:bg-ember",
          across ? "h-10 w-1" : "h-1 w-10",
        ].join(" ")}
      />
    </Separator>
  );
}

/* -------------------------------------------------------- description */

function Description({
  problem,
  examples,
  onUseExample,
}: {
  problem: Problem;
  examples: Example[];
  onUseExample: (index: number) => void;
}) {
  return (
    <article className="@container space-y-7 px-5 py-5 text-[15px] leading-[1.7] text-ink-2 sm:px-6">
      <div className="flex flex-wrap items-center gap-1.5">
        {problem.tags.map((tag) => (
          <Link key={tag.slug} to={`/problems?tags=${tag.slug}`} className="chip text-xs">
            {tag.name}
          </Link>
        ))}
        {problem.rating != null && (
          <span className="rounded-full border border-line px-2.5 py-1 font-mono text-xs text-ink-3">
            rating {problem.rating}
          </span>
        )}
        <span className="rounded-full border border-line px-2.5 py-1 font-mono text-xs text-ink-3">
          {problem.total_test_case_count} tests · {problem.sample_test_case_count} shown
        </span>
      </div>

      <div>
        <Markdown text={problem.description} />
      </div>

      {problem.input_format.trim() && (
        <StatementSection title="Input">
          <Markdown text={problem.input_format} />
        </StatementSection>
      )}
      {problem.output_format.trim() && (
        <StatementSection title="Output">
          <Markdown text={problem.output_format} />
        </StatementSection>
      )}
      {problem.constraints.trim() && (
        <StatementSection title="Constraints">
          <div className="rounded-xl border border-line bg-bg-raised px-4 py-3 font-mono text-[13px] leading-relaxed">
            <Markdown text={problem.constraints} />
          </div>
        </StatementSection>
      )}

      {examples.length > 0 && (
        <StatementSection title={examples.length === 1 ? "Example" : "Examples"}>
          <div className="space-y-3">
            {examples.map((example, index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-line bg-bg-raised">
                <div className="flex items-center justify-between gap-3 border-b border-line py-1 pr-1.5 pl-3.5">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-ink-3 uppercase">
                    Sample {index + 1}
                  </span>
                  <button
                    onClick={() => onUseExample(index)}
                    className="min-h-8 rounded-lg px-2.5 text-xs font-medium text-ember transition-colors hover:bg-ember/10 hover:text-ember-2"
                  >
                    Use as test input ↓
                  </button>
                </div>
                <div className="grid @md:grid-cols-2">
                  <ExampleBlock label="Input" body={example.input} />
                  <div className="border-t border-line @md:border-t-0 @md:border-l">
                    <ExampleBlock label="Output" body={example.output} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </StatementSection>
      )}

      {problem.source && (
        <p className="border-t border-line pt-4 text-xs text-ink-3">
          Source:{" "}
          {problem.source_url ? (
            <a
              href={problem.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ember"
            >
              {problem.source}
            </a>
          ) : (
            <span className="text-ink-2">{problem.source}</span>
          )}
          {problem.license && <> · {problem.license}</>}
        </p>
      )}
    </article>
  );
}

function StatementSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function ExampleBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="min-w-0 p-3.5">
      <p className="mb-1.5 font-mono text-[10.5px] tracking-[0.14em] text-ink-3 uppercase">{label}</p>
      <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-ink">{body.replace(/\n$/, "")}</pre>
    </div>
  );
}

/* ------------------------------------------------------------ console */

function TestInput({
  examples,
  stdin,
  onChange,
}: {
  examples: Example[];
  stdin: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex h-full min-h-40 flex-col gap-3">
      {examples.length > 0 && (
        <div role="group" aria-label="Load a sample case" className="flex flex-wrap items-center gap-1.5">
          {examples.map((example, index) => (
            <button
              key={index}
              aria-pressed={sameText(example.input, stdin)}
              onClick={() => onChange(example.input)}
              className="chip text-xs"
            >
              Sample {index + 1}
            </button>
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <label htmlFor="stdin" className="mb-1.5 font-mono text-[11px] tracking-[0.14em] text-ink-3 uppercase">
          Custom input · stdin
        </label>
        <textarea
          id="stdin"
          value={stdin}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="field min-h-24 flex-1 resize-none font-mono text-[13px]! leading-relaxed"
          placeholder="Input passed to your program when you press Run"
        />
      </div>
      <p className="text-xs text-ink-3">
        <strong className="font-medium text-ink-2">Run</strong> uses this input.{" "}
        <strong className="font-medium text-ink-2">Submit</strong> judges every test, hidden ones included.
      </p>
    </div>
  );
}

function IdleConsole({ signedIn, slug }: { signedIn: boolean; slug: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="max-w-sm text-sm text-ink-2">
        Run your code on a sample, or submit it to be judged on every test.
      </p>
      {signedIn ? (
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-3">
          <span>
            <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">'</kbd> run
          </span>
          <span>
            <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Enter</kbd> submit
          </span>
        </p>
      ) : (
        <p className="text-sm text-ink-3">
          <Link to="/login" state={{ from: `/problems/${slug}` }} className="font-semibold text-ember hover:text-ember-2">
            Sign in
          </Link>{" "}
          to run or submit.
        </p>
      )}
    </div>
  );
}

function LoadingWorkspace() {
  return (
    <div className="flex flex-col gap-2.5 p-3 min-[900px]:h-[calc(100dvh-3.75rem)]" aria-busy="true" aria-label="Loading problem">
      <Skeleton className="h-11 w-full max-w-xl" />
      <div className="grid min-h-0 flex-1 gap-2.5 min-[900px]:grid-cols-[44fr_56fr]">
        <Skeleton className="h-[60dvh] min-[900px]:h-full" />
        <div className="hidden flex-col gap-2.5 min-[900px]:flex">
          <Skeleton className="flex-[62]" />
          <Skeleton className="flex-[38]" />
        </div>
      </div>
    </div>
  );
}
