import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../../lib/api";
import type { Editorial } from "../../lib/types";
import { Markdown } from "../Markdown";
import { Button, Spinner } from "../ui";

/**
 * The editorial sits behind a deliberate click: opening it is a choice to
 * see the solution, and a first opening may ask the AI to draft it.
 */
export function EditorialTab({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [editorial, setEditorial] = useState<Editorial | null>(null);
  const [state, setState] = useState<"closed" | "loading" | "error">("closed");
  const [message, setMessage] = useState<string | null>(null);

  async function open() {
    setState("loading");
    setMessage(null);
    try {
      setEditorial(await api.editorial(slug));
    } catch (error) {
      setState("error");
      if (error instanceof ApiError && error.status === 401) {
        setMessage("Sign in to open the editorial.");
      } else {
        setMessage(error instanceof Error ? error.message : "Could not load the editorial.");
      }
    }
  }

  if (editorial) {
    return (
      <article className="space-y-3 px-5 py-5 text-[15px] leading-relaxed text-ink-2">
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-3">
          {editorial.author === "staff"
            ? "Written by the Crucible team."
            : `Drafted by AI from a solution verified against every test (${editorial.author.replace(/^AI draft \(|\)$/g, "")}). Double-check anything that looks off.`}
        </p>
        <Markdown text={editorial.body} />
      </article>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-line bg-surface-2 text-2xl" aria-hidden="true">
        ✎
      </div>
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Editorial</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
          The key idea, the algorithm, its complexity and a working solution. Try the coach's hints first, then open
          this when you're ready to see the answer.
        </p>
      </div>
      {state === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-ink-3" aria-live="polite">
          <Spinner size={15} /> Opening… a first opening can take a few seconds.
        </p>
      ) : signedIn ? (
        <Button onClick={open}>Show the editorial</Button>
      ) : (
        <Link to="/login" state={{ from: `/problems/${slug}` }} className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold">
          Sign in to open it
        </Link>
      )}
      {message && (
        <p role="alert" className="max-w-sm text-sm text-ink-2">
          {message}
        </p>
      )}
    </div>
  );
}
