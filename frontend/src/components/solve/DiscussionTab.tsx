import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../../lib/api";
import { relativeTime } from "../../lib/format";
import type { DiscussionPost } from "../../lib/types";
import { Markdown } from "../Markdown";
import { Button, Skeleton } from "../ui";

/** A problem's discussion board: threads, one level of replies, upvotes. */
export function DiscussionTab({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [threads, setThreads] = useState<DiscussionPost[] | null>(null);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<"top" | "new">("top");
  const [blocked, setBlocked] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .discussions(slug, { sort, limit: 30 })
      .then((page) => {
        if (cancelled) return;
        setThreads(page.items);
        setTotal(page.total);
        setBlocked(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setThreads([]);
        setBlocked(error instanceof ApiError && error.status === 403 ? error.message : "Could not load the discussion.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, sort, reload]);

  const refresh = () => setReload((n) => n + 1);

  if (blocked) {
    return <p className="px-6 py-14 text-center text-sm text-ink-2">{blocked}</p>;
  }

  return (
    <div className="space-y-4 px-5 py-5">
      {signedIn ? (
        <Composer slug={slug} placeholder="Share an approach, ask a question… (Markdown and $maths$ work)" onPosted={refresh} />
      ) : (
        <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
          <Link to="/login" state={{ from: `/problems/${slug}` }} className="font-semibold text-ember hover:underline">
            Sign in
          </Link>{" "}
          to join the discussion.
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">
          {total} {total === 1 ? "thread" : "threads"}
        </p>
        <div className="flex gap-1" role="group" aria-label="Sort threads">
          {(["top", "new"] as const).map((key) => (
            <button key={key} onClick={() => setSort(key)} aria-pressed={sort === key} className="chip text-xs!">
              {key === "top" ? "Top" : "Newest"}
            </button>
          ))}
        </div>
      </div>

      {threads === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : threads.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">No threads yet. Spoilers are fine here, so be kind and explain.</p>
      ) : (
        <ul className="space-y-3">
          {threads.map((thread) => (
            <li key={thread.id} className="rounded-xl border border-line bg-surface-2/50 p-4">
              <Post post={thread} signedIn={signedIn} onChanged={refresh} />
              {thread.replies.length > 0 && (
                <ul className="mt-3 space-y-3 border-l-2 border-line pl-4">
                  {thread.replies.map((reply) => (
                    <li key={reply.id}>
                      <Post post={reply} signedIn={signedIn} onChanged={refresh} />
                    </li>
                  ))}
                </ul>
              )}
              {signedIn && thread.body !== null && <ReplyBox slug={slug} parentId={thread.id} onPosted={refresh} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Post({ post, signedIn, onChanged }: { post: DiscussionPost; signedIn: boolean; onChanged: () => void }) {
  const [votes, setVotes] = useState({ votes: post.votes, voted: post.voted_by_me });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body ?? "");

  async function vote() {
    const result = await api.votePost(post.id);
    setVotes({ votes: result.votes, voted: result.voted_by_me });
  }

  async function save() {
    await api.editPost(post.id, draft);
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!window.confirm("Delete this post?")) return;
    await api.deletePost(post.id);
    onChanged();
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={vote}
        disabled={!signedIn || post.body === null}
        aria-pressed={votes.voted}
        aria-label={`Upvote, ${votes.votes} votes`}
        className={`flex h-12 w-9 shrink-0 flex-col items-center justify-center rounded-lg border text-xs transition-colors ${
          votes.voted ? "border-ember/50 bg-ember/12 text-ember" : "border-line text-ink-3 hover:text-ink"
        } disabled:opacity-60`}
      >
        <span aria-hidden="true">▲</span>
        <span className="font-mono">{votes.votes}</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-3">
          <span className="font-semibold text-ink-2">{post.author}</span> · {relativeTime(post.created_at)}
          {post.edited && " · edited"}
        </p>
        {post.body === null ? (
          <p className="mt-1 text-sm text-ink-3 italic">This post was deleted.</p>
        ) : editing ? (
          <div className="mt-2 space-y-2">
            <label className="sr-only" htmlFor={`edit-${post.id}`}>
              Edit post
            </label>
            <textarea id={`edit-${post.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="field resize-y" />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={!draft.trim()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1 text-sm leading-relaxed break-words text-ink-2">
            <Markdown text={post.body} />
          </div>
        )}
        {post.mine && post.body !== null && !editing && (
          <div className="mt-1.5 flex gap-3 text-xs">
            <button onClick={() => setEditing(true)} className="text-ink-3 hover:text-ink">
              Edit
            </button>
            <button onClick={remove} className="text-ink-3 hover:text-fail">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  slug,
  parentId,
  placeholder,
  onPosted,
  compact = false,
}: {
  slug: string;
  parentId?: number;
  placeholder: string;
  onPosted: () => void;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `compose-${parentId ?? "thread"}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createPost(slug, { body: body.trim(), parent_id: parentId });
      setBody("");
      onPosted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={id} className="sr-only">
        {parentId ? "Write a reply" : "Start a thread"}
      </label>
      <textarea
        id={id}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 2 : 3}
        maxLength={5000}
        placeholder={placeholder}
        className="field resize-y"
      />
      {error && (
        <p role="alert" className="text-xs text-fail">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
        {parentId ? "Reply" : "Post"}
      </Button>
    </form>
  );
}

function ReplyBox({ slug, parentId, onPosted }: { slug: string; parentId: number; onPosted: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-xs font-semibold text-ink-3 hover:text-ink">
        ↳ Reply
      </button>
    );
  }
  return (
    <div className="mt-3 pl-4">
      <Composer slug={slug} parentId={parentId} placeholder="Write a reply…" onPosted={onPosted} compact />
    </div>
  );
}
