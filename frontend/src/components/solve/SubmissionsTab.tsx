import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { LANGUAGE_LABELS, formatDate, formatMemory, relativeTime } from "../../lib/format";
import type { LanguageId, Page, Submission } from "../../lib/types";
import { CodeEditor } from "../CodeEditor";
import { Alert, Button, EmptyState, Skeleton, VerdictBadge } from "../ui";
import { SubmissionResult } from "./Verdict";

/**
 * The signed-in user's own attempts at this problem, newest first. Picking
 * one fetches it in full (source code and judge message) and shows it here,
 * with a way to bring that code back into the editor.
 */
export function SubmissionsTab({
  problemId,
  slug,
  signedIn,
  refreshKey,
  onOpenInEditor,
}: {
  problemId: number;
  slug: string;
  signedIn: boolean;
  /** Bumped by the page after each submit, so the list picks it up. */
  refreshKey: number;
  onOpenInEditor: (language: LanguageId, code: string) => void;
}) {
  const [list, setList] = useState<{ key: number; page: Page<Submission> | null; error: string | null } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ id: number; submission: Submission | null; error: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api
      .submissions({ problem_id: problemId, limit: 50 })
      .then((page) => live && setList({ key: refreshKey, page, error: null }))
      .catch((error: Error) => live && setList({ key: refreshKey, page: null, error: error.message }));
    return () => {
      live = false;
    };
  }, [problemId, refreshKey, signedIn]);

  useEffect(() => {
    if (selected == null) return;
    let live = true;
    api
      .submission(selected)
      .then((submission) => live && setDetail({ id: selected, submission, error: null }))
      .catch((error: Error) => live && setDetail({ id: selected, submission: null, error: error.message }));
    return () => {
      live = false;
    };
  }, [selected]);

  if (!signedIn) {
    return (
      <EmptyState
        icon="⌁"
        title="Your attempts live here"
        description="Sign in to keep a history of every run at this problem, with verdicts and code."
        action={
          <Link to="/login" state={{ from: `/problems/${slug}` }} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
            Sign in
          </Link>
        }
      />
    );
  }

  if (selected != null) {
    const ready = detail?.id === selected ? detail : null;
    return (
      <div className="space-y-4 p-4 sm:p-5">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden="true">←</span> All submissions
        </button>

        {!ready ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-28" />
            <Skeleton className="h-64" />
          </div>
        ) : ready.error || !ready.submission ? (
          <Alert>{ready.error ?? "Submission not found"}</Alert>
        ) : (
          <SubmissionDetail submission={ready.submission} onOpenInEditor={onOpenInEditor} />
        )}
      </div>
    );
  }

  const current = list;
  if (!current) {
    return (
      <div className="space-y-2 p-4" aria-busy="true">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    );
  }
  if (current.error) return <div className="p-4"><Alert>{current.error}</Alert></div>;

  const items = current.page?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon="◇"
        title="No submissions yet"
        description="Submit a solution and it will be listed here with its verdict, runtime and memory."
      />
    );
  }

  return (
    <div>
      <p className="px-5 pt-4 pb-2 font-mono text-[11px] tracking-[0.14em] text-ink-3 uppercase" aria-live="polite">
        {current.page?.total ?? items.length} submission{(current.page?.total ?? items.length) === 1 ? "" : "s"}
        {current.key !== refreshKey && " · refreshing…"}
      </p>
      <ul className="px-2 pb-3">
        {items.map((submission) => (
          <li key={submission.id}>
            <button
              onClick={() => setSelected(submission.id)}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <VerdictBadge verdict={submission.verdict} />
                <span className="truncate text-sm text-ink-2">{LANGUAGE_LABELS[submission.language] ?? submission.language}</span>
              </span>
              <span className="hidden font-mono text-xs text-ink-3 tabular-nums sm:block">
                {submission.execution_time_ms.toFixed(0)} ms · {formatMemory(submission.memory_kb)}
              </span>
              <time dateTime={submission.created_at} title={formatDate(submission.created_at)} className="text-right text-xs text-ink-3">
                {relativeTime(submission.created_at)}
              </time>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubmissionDetail({
  submission,
  onOpenInEditor,
}: {
  submission: Submission;
  onOpenInEditor: (language: LanguageId, code: string) => void;
}) {
  return (
    <>
      <p className="text-xs text-ink-3">
        Submission #{submission.id} · {LANGUAGE_LABELS[submission.language] ?? submission.language} ·{" "}
        {formatDate(submission.created_at)}
      </p>
      <SubmissionResult submission={submission} />
      {submission.source_code != null && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] tracking-[0.14em] text-ink-3 uppercase">Code</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenInEditor(submission.language, submission.source_code ?? "")}
            >
              Open in editor
            </Button>
          </div>
          <div className="max-h-[440px] overflow-auto rounded-xl border border-line">
            <CodeEditor
              value={submission.source_code}
              language={submission.language}
              readOnly
              height="auto"
              label={`Code of submission ${submission.id}`}
            />
          </div>
        </div>
      )}
    </>
  );
}
