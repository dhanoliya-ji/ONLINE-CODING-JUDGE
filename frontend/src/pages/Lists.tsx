import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { DIFFICULTY_TEXT } from "../lib/format";
import type { ProblemListInfo, ProblemSummary } from "../lib/types";
import { Alert, Button, Card, EmptyState, PageHeading, Skeleton } from "../components/ui";

/** Your problem lists: Bookmarks plus any you make ("Graphs to redo"…). */
export function Lists() {
  const [params, setParams] = useSearchParams();
  const [lists, setLists] = useState<ProblemListInfo[] | null>(null);
  const [problems, setProblems] = useState<ProblemSummary[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(() => {
    api.lists().then(setLists).catch((e) => setError(e.message));
  }, []);
  useEffect(loadLists, [loadLists]);

  const selected = lists?.find((l) => String(l.id) === params.get("list")) ?? lists?.[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    api
      .listProblems(selected.id, { limit: 100 })
      .then((page) => !cancelled && setProblems(page.items))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      const made = await api.createList(name.trim());
      setName("");
      loadLists();
      setParams({ list: String(made.id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the list");
    }
  }

  async function remove(problemId: number) {
    if (!selected) return;
    await api.removeFromList(selected.id, problemId);
    setProblems((current) => current?.filter((p) => p.id !== problemId) ?? null);
    loadLists();
  }

  async function deleteList() {
    if (!selected || !window.confirm(`Delete the list "${selected.name}"? The problems themselves stay.`)) return;
    await api.deleteList(selected.id);
    setParams({});
    loadLists();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeading eyebrow="Practice" title="My lists" description="Problems you bookmarked or grouped to come back to." />
      {error && (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4">
          {lists === null ? (
            <Skeleton className="h-40" />
          ) : (
            <nav aria-label="Lists" className="panel overflow-hidden p-1.5">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setParams({ list: String(list.id) })}
                  aria-current={selected?.id === list.id ? "page" : undefined}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                    selected?.id === list.id ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  <span className="truncate">{list.name}</span>
                  <span className="font-mono text-xs text-ink-3">{list.problem_count}</span>
                </button>
              ))}
            </nav>
          )}
          <form onSubmit={create} className="flex gap-2">
            <label htmlFor="new-list" className="sr-only">
              New list name
            </label>
            <input id="new-list" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="New list…" className="field" />
            <Button type="submit" size="sm" disabled={!name.trim()}>
              Add
            </Button>
          </form>
        </aside>

        <section aria-label={selected ? `Problems in ${selected.name}` : "Problems"}>
          {selected && (
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">{selected.name}</h2>
              {selected.name !== "Bookmarks" && (
                <button onClick={deleteList} className="text-xs text-ink-3 hover:text-fail">
                  Delete list
                </button>
              )}
            </div>
          )}
          {problems === null ? (
            <Skeleton className="h-64" />
          ) : problems.length === 0 ? (
            <Card solid>
              <EmptyState
                icon="☆"
                title="Nothing here yet"
                description="Use the bookmark button on any problem to save it here."
                action={
                  <Link to="/problems" className="btn-primary mt-2 rounded-xl px-5 py-2.5 text-sm font-semibold">
                    Browse problems
                  </Link>
                }
              />
            </Card>
          ) : (
            <ul className="panel divide-y divide-line overflow-hidden">
              {problems.map((problem) => (
                <li key={problem.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-4 text-pass" aria-label={problem.solved_by_me ? "Solved" : undefined}>
                    {problem.solved_by_me ? "✓" : ""}
                  </span>
                  <Link to={`/problems/${problem.slug}`} className="min-w-0 flex-1 truncate text-sm text-ink hover:text-ember">
                    {problem.title}
                  </Link>
                  <span className={`font-mono text-xs ${DIFFICULTY_TEXT[problem.difficulty]}`}>{problem.difficulty}</span>
                  <button
                    onClick={() => remove(problem.id)}
                    aria-label={`Remove ${problem.title} from ${selected?.name}`}
                    className="rounded-md px-2 py-1 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
