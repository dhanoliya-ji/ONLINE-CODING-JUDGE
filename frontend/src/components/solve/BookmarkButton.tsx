import { useEffect, useState } from "react";
import { api } from "../../lib/api";

/** Save the problem to your "Bookmarks" list (manage lists on /lists). */
export function BookmarkButton({ problemId }: { problemId: number }) {
  const [listId, setListId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.lists(), api.listsContaining(problemId)])
      .then(([lists, containing]) => {
        if (cancelled) return;
        const bookmarks = lists.find((list) => list.name === "Bookmarks") ?? lists[0];
        if (!bookmarks) return;
        setListId(bookmarks.id);
        setSaved(containing.includes(bookmarks.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [problemId]);

  async function toggle() {
    if (listId == null || busy) return;
    setBusy(true);
    try {
      if (saved) await api.removeFromList(listId, problemId);
      else await api.addToList(listId, problemId);
      setSaved(!saved);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={listId == null}
      aria-pressed={saved}
      aria-label={saved ? "Remove from bookmarks" : "Bookmark this problem"}
      title={saved ? "Bookmarked" : "Bookmark"}
      className={`btn-ghost grid size-9 shrink-0 place-items-center rounded-xl transition-colors ${saved ? "text-ember" : "text-ink-2"}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} aria-hidden="true">
        <path d="M6 4h12v17l-6-4-6 4V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
