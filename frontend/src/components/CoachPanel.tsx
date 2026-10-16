import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { CoachMessage, CoachStatus } from "../lib/types";
import { Markdown } from "./Markdown";

const QUICK_ASKS = [
  { label: "💡 Hint", text: "Can you give me a small hint? Don't give away the solution." },
  { label: "🧭 Check my approach", text: "Here is my approach so far. Is it on the right track? " },
  { label: "🐞 Why is it failing?", text: "Why is my code failing? Point me to the bug." },
  { label: "⏱ Fast enough?", text: "Is my solution fast enough for the constraints? What is its complexity?" },
  { label: "📖 Full solution", text: "I give up for now: please explain the full solution with code." },
];

/** Only the most recent turns are sent: enough context, far fewer tokens. */
const SENT_TURNS = 12;

const historyKey = (slug: string) => `crucible.coach.${slug}`;

function loadHistory(slug: string): CoachMessage[] {
  try {
    const raw = localStorage.getItem(historyKey(slug));
    return raw ? (JSON.parse(raw) as CoachMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(slug: string, messages: CoachMessage[]) {
  try {
    localStorage.setItem(historyKey(slug), JSON.stringify(messages.slice(-40)));
  } catch {
    // Private windows and full storage only lose the history, not the chat.
  }
}

/**
 * The practice coach: a chat drawer about the current problem.
 *
 * Rendered only when the server says the coach is available here (or that
 * signing in would make it so). For a contest problem, or a user in a live
 * contest, the server reports it unavailable and nothing is shown at all --
 * and the server refuses the chat itself too, so hiding is not the guard.
 *
 * Keyed by problem where it is rendered, so each problem starts fresh.
 */
export function CoachPanel({
  slug,
  code,
  language,
  verdict,
}: {
  slug: string;
  code: string;
  language: string;
  verdict: string | null;
}) {
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>(() => loadHistory(slug));
  const [draft, setDraft] = useState("");
  const [shareCode, setShareCode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .coachStatus(slug)
      .then((found) => !cancelled && setStatus(found))
      .catch(() => !cancelled && setStatus(null));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const needsSignIn = status !== null && !status.available && status.reason?.startsWith("Sign in");
  if (status === null || (!status.available && !needsSignIn)) return null;

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    saveHistory(slug, next);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const answer = await api.askCoach(slug, {
        messages: next.slice(-SENT_TURNS),
        code: shareCode ? code : null,
        language: shareCode ? language : null,
        verdict: shareCode ? verdict : null,
      });
      const withReply = [...next, { role: "assistant" as const, content: answer.reply }];
      setMessages(withReply);
      saveHistory(slug, withReply);
      setStatus((current) => current && { ...current, remaining_today: answer.remaining_today });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The coach could not answer.");
      // A contest that started while the drawer was open: hide the coach.
      if (caught instanceof ApiError && caught.status === 403) {
        setStatus((current) => current && { ...current, available: false, reason: caught.message });
      }
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  // Asks ending in a space are openers the student finishes; the rest send.
  function quickAsk(text: string) {
    if (text.endsWith(" ")) {
      setDraft(text);
      inputRef.current?.focus();
    } else {
      void send(text);
    }
  }

  function clear() {
    setMessages([]);
    saveHistory(slug, []);
    setError(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="coach-panel"
        className="fixed right-5 bottom-5 z-40 flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-500/90 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_-8px_rgba(139,92,246,0.8)] backdrop-blur transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
      >
        <span aria-hidden>✦</span> Ask Coach
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <aside
            id="coach-panel"
            role="dialog"
            aria-label="Practice coach"
            onClick={(event) => event.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#130f22] shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
              <div>
                <h2 className="font-semibold text-violet-50">
                  <span aria-hidden className="text-violet-300">✦ </span>Crucible Coach
                </h2>
                <p className="mt-0.5 text-xs text-violet-200/55">
                  Practice only · off during contests
                  {status.remaining_today != null && ` · ${status.remaining_today} replies left today`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={clear} className="rounded-md px-2 py-1 text-xs text-violet-300/60 hover:bg-white/5 hover:text-violet-200">
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close coach"
                  className="rounded-md px-2 py-1 text-lg leading-none text-violet-200/60 hover:bg-white/5 hover:text-violet-100"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
              {messages.length === 0 && (
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-relaxed text-violet-100/80">
                  Stuck, or want a second opinion? Talk through your approach, ask for a hint, or
                  ask why your code fails. I can see the problem
                  {shareCode ? ", your code and your last verdict" : ""}. I'll guide you rather than
                  hand over the answer, unless you ask for the full solution.
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={message.role === "user" ? "flex justify-end" : undefined}>
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-md bg-violet-500/25 px-4 py-2.5 text-sm whitespace-pre-wrap text-violet-50"
                        : "text-sm leading-relaxed text-violet-100/90"
                    }
                  >
                    {message.role === "user" ? message.content : <CoachReply text={message.content} />}
                  </div>
                </div>
              ))}

              {busy && (
                <p className="flex items-center gap-2 text-sm text-violet-300/70">
                  <span className="inline-block size-2 animate-pulse rounded-full bg-violet-400" /> Thinking…
                </p>
              )}
              {error && (
                <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}
              <div ref={endRef} />
            </div>

            {needsSignIn ? (
              <div className="border-t border-white/8 px-5 py-4 text-sm text-violet-200/70">
                <Link to="/login" state={{ from: `/problems/${slug}` }} className="font-semibold text-violet-300 hover:text-violet-200">
                  Sign in
                </Link>{" "}
                to chat with the coach. It's free.
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3 border-t border-white/8 px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ASKS.map((ask) => (
                    <button
                      key={ask.label}
                      type="button"
                      disabled={busy}
                      onClick={() => quickAsk(ask.text)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-violet-100/80 transition-colors hover:border-violet-300/40 hover:text-violet-50 disabled:opacity-50"
                    >
                      {ask.label}
                    </button>
                  ))}
                </div>
                <label htmlFor="coach-input" className="sr-only">
                  Message the coach
                </label>
                <textarea
                  id="coach-input"
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                  rows={3}
                  maxLength={4000}
                  placeholder="Ask anything: your approach, a hint, a concept…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-violet-50 placeholder:text-violet-200/35 focus:border-violet-400/60 focus:outline-none"
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-violet-200/60">
                    <input type="checkbox" checked={shareCode} onChange={(event) => setShareCode(event.target.checked)} className="accent-violet-500" />
                    Share my code
                  </label>
                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </form>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

/** Coach replies: fenced code blocks, with the prose between them as Markdown. */
function CoachReply({ text }: { text: string }) {
  const parts = text.split(/```([\w+#-]*)\n([\s\S]*?)```/g);
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i].trim()) out.push(<Markdown key={`t${i}`} text={parts[i].trim()} />);
    if (i + 2 < parts.length) {
      out.push(
        <pre key={`c${i}`} className="my-3 overflow-x-auto rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-[12.5px] leading-relaxed text-violet-50">
          <code>{parts[i + 2].replace(/\n$/, "")}</code>
        </pre>,
      );
    }
  }
  return <>{out}</>;
}
