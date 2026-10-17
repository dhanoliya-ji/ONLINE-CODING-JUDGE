import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Facets, ProblemSort } from "../lib/types";
import { Alert, Button, Card, EmptyState, Eyebrow, Kbd, Spinner } from "../components/ui";
import { DailyCard } from "../components/problems/DailyCard";
import { FilterPanel } from "../components/problems/FilterPanel";
import { Pagination } from "../components/problems/Pagination";
import { ProblemResults } from "../components/problems/ProblemResults";
import { useKeyedRequest } from "../components/problems/useKeyedRequest";
import {
  PAGE_SIZE,
  SORTS,
  STATUSES,
  activeFilterCount,
  naturalOrder,
  orderLabel,
  toQuery,
  useProblemFilters,
} from "../components/problems/filters";

const loadProblems = (key: string) => api.problems(JSON.parse(key));

export function Problems() {
  const { user, loading: authLoading } = useAuth();
  const signedIn = Boolean(user);
  const navigate = useNavigate();
  const { filters, update, clear } = useProblemFilters();

  const [facets, setFacets] = useState<Facets | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const sortId = useId();
  const filtersId = useId();

  useEffect(() => {
    api.facets().then(setFacets).catch(() => setFacets({ tags: [], sources: {}, difficulties: {} }));
  }, []);

  /* ------------------------------------------------------------ Search box */

  // The box is a draft of the URL's `q`: typing updates it immediately and
  // the URL after a pause; a URL change (back button, clear) resets it.
  const [draft, setDraft] = useState(filters.q);
  const [seenQ, setSeenQ] = useState(filters.q);
  if (filters.q !== seenQ) {
    setSeenQ(filters.q);
    if (draft.trim() !== filters.q) setDraft(filters.q);
  }

  useEffect(() => {
    const next = draft.trim();
    if (next === filters.q) return;
    const timer = setTimeout(() => {
      // Refining a search replaces the history entry; starting one pushes,
      // so Back returns to the unsearched list.
      update({ q: next }, { replace: filters.q !== "" && next !== "" });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, filters.q, update]);

  // "/" jumps to search, as on most code sites.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* --------------------------------------------------------------- Results */

  const query = useMemo(() => toQuery(filters, signedIn), [filters, signedIn]);
  const queryKey = JSON.stringify(query);

  // Wait for a stored session to resolve so the first list already carries
  // the viewer's solved marks (and status filter).
  const request = useKeyedRequest(authLoading ? null : queryKey, loadProblems);
  const { loading, error } = request;
  const problems = request.value?.items ?? [];
  const total = request.value?.total ?? null;

  // A page past the end (e.g. after a filter shrank the list) snaps back.
  const lastPage = total === null ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (!loading && total !== null && filters.page > lastPage) update({ page: lastPage }, { replace: true });
  }, [loading, total, filters.page, lastPage, update]);

  function goToPage(page: number) {
    update({ page });
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------------------------------------------------------- Random */

  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  async function pickRandom() {
    setPicking(true);
    setPickError(null);
    try {
      const problem = await api.randomProblem({
        difficulty: filters.difficulty.length ? filters.difficulty : undefined,
        tags: filters.tags.length ? filters.tags.join(",") : undefined,
      });
      navigate(`/problems/${problem.slug}`);
    } catch (err) {
      setPickError(
        err instanceof ApiError && err.status === 404
          ? signedIn
            ? "You've solved every problem matching these filters. Loosen one to pick again."
            : "No problem matches these filters."
          : err instanceof Error
            ? err.message
            : "Could not pick a problem",
      );
    } finally {
      setPicking(false);
    }
  }

  /* --------------------------------------------------------------- Derived */

  const activeCount = activeFilterCount(filters, signedIn);
  const narrowed = activeCount > 0 || filters.q !== "";
  const libraryTotal = facets
    ? Object.values(facets.difficulties).reduce((sum, count) => sum + count, 0)
    : null;
  const tagName = (slug: string) => facets?.tags.find((tag) => tag.slug === slug)?.name ?? slug;
  // While searching, relevance is the default, so it replaces "Default".
  const sortOptions = SORTS.filter((option) =>
    filters.q ? option.value !== "" : !option.searchOnly,
  );
  const sortValue = filters.sort === "" && filters.q ? "relevance" : filters.sort;
  const orderMatters = sortValue !== "relevance";

  const first = (filters.page - 1) * PAGE_SIZE + 1;
  const countText =
    total === null
      ? "Loading problems…"
      : total === 0
        ? "No problems match"
        : `${first.toLocaleString()}–${Math.min(first + PAGE_SIZE - 1, total).toLocaleString()} of ${total.toLocaleString()} problem${total === 1 ? "" : "s"}`;

  const removable: { key: string; label: string; remove: () => void }[] = [
    ...filters.difficulty.map((level) => ({
      key: `d-${level}`,
      label: level,
      remove: () => update({ difficulty: filters.difficulty.filter((entry) => entry !== level) }),
    })),
    ...(signedIn && filters.status
      ? [
          {
            key: "status",
            label: STATUSES.find((option) => option.value === filters.status)?.label ?? filters.status,
            remove: () => update({ status: "" }),
          },
        ]
      : []),
    ...filters.tags.map((slug) => ({
      key: `t-${slug}`,
      label: tagName(slug),
      remove: () => update({ tags: filters.tags.filter((entry) => entry !== slug) }),
    })),
    ...(filters.source ? [{ key: "source", label: filters.source, remove: () => update({ source: "" }) }] : []),
    ...(filters.minRating !== null || filters.maxRating !== null
      ? [
          {
            key: "rating",
            label: `Rating ${filters.minRating ?? 0}–${filters.maxRating ?? "∞"}`,
            remove: () => update({ minRating: null, maxRating: null }),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <Eyebrow>Practice</Eyebrow>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Problems</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-2">
            {libraryTotal ? `${libraryTotal.toLocaleString()} problems` : "Problems"} from Codeforces, CodeChef and
            AtCoder, each judged against its full test suite.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[272px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8 xl:grid-cols-[296px_minmax(0,1fr)]">
        {/* Source order is daily card → filters → results so that on phones the
            opened filter panel appears right under its toggle; on desktop the
            grid puts the filters in their own column. */}
        <div className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-1">
          <DailyCard signedIn={signedIn} />

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-0 flex-[1_1_260px]">
              <label htmlFor={searchId} className="sr-only">
                Search problems
              </label>
              <svg
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && draft) setDraft("");
                }}
                placeholder="Search titles and statements…"
                autoComplete="off"
                spellCheck={false}
                className="field min-h-11 pr-10! pl-10! text-[15px]"
              />
              {!draft && (
                <span className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 sm:block" aria-hidden="true">
                  <Kbd>/</Kbd>
                </span>
              )}
            </div>

            <Button variant="ghost" onClick={pickRandom} loading={picking} className="min-h-11 flex-1 sm:flex-none">
              {!picking && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              Pick one for me
            </Button>

            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              className="btn-ghost inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold sm:flex-none lg:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Filters
              {activeCount > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-ember px-1.5 font-mono text-[11px] text-ember-ink">
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          <div aria-live="polite" className="empty:hidden">
            {pickError && <Alert tone="warn">{pickError}</Alert>}
          </div>
        </div>

        <aside
          id={filtersId}
          aria-label="Filters"
          className={[
            "lg:sticky lg:top-22 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:block lg:max-h-[calc(100dvh-6.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1 lg:pb-4",
            filtersOpen ? "block" : "hidden",
          ].join(" ")}
        >
          {/* A card on small screens; on desktop the column itself is the frame. */}
          <div className="rounded-2xl border border-line bg-surface p-5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
            <FilterPanel filters={filters} update={update} facets={facets} signedIn={signedIn} />
            {narrowed && (
              <button
                type="button"
                onClick={clear}
                className="mt-7 w-full rounded-xl border border-dashed border-line-strong py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-ember/50 hover:text-ink"
              >
                Clear all filters
              </button>
            )}
          </div>
        </aside>

        <section aria-label="Problem list" className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-2">

          {/* Count, active filters, sort */}
          <div ref={resultsRef} className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="mr-1 font-mono text-[13px] text-ink-2 tabular-nums" aria-live="polite" aria-atomic="true">
                {countText}
              </p>
              {loading && total !== null && (
                <span className="text-ember">
                  <Spinner size={14} />
                </span>
              )}
              {removable.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.remove}
                  aria-label={`Remove filter: ${item.label}`}
                  className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-ember/35 bg-ember/10 py-0.5 pr-2 pl-2.5 text-xs font-medium text-ink transition-colors hover:border-ember/60"
                >
                  {item.label}
                  <span className="text-ink-3" aria-hidden="true">
                    ✕
                  </span>
                </button>
              ))}
              {narrowed && (
                <button
                  type="button"
                  onClick={clear}
                  className="min-h-7 rounded-full px-2 text-xs font-semibold text-ember-2 hover:text-ember"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor={sortId} className="font-mono text-[11px] tracking-[0.12em] text-ink-3 uppercase">
                Sort
              </label>
              <select
                id={sortId}
                value={sortValue}
                onChange={(event) => {
                  const sort = event.target.value as ProblemSort | "";
                  update({ sort, order: naturalOrder(sort) });
                }}
                className="field h-9 w-auto! cursor-pointer py-0! pr-8! pl-3! text-sm"
              >
                {sortOptions.map((option) => (
                  <option key={option.value || "default"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {orderMatters && (
                <button
                  type="button"
                  onClick={() => update({ order: filters.order === "asc" ? "desc" : "asc" })}
                  aria-label={`Order: ${orderLabel(filters.sort, filters.order)}. Reverse it.`}
                  title="Reverse order"
                  className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap text-ink-2"
                >
                  <span aria-hidden="true" className="font-mono text-sm text-ink">
                    {filters.order === "asc" ? "↑" : "↓"}
                  </span>
                  <span className="hidden sm:inline">{orderLabel(filters.sort, filters.order)}</span>
                </button>
              )}
            </div>
          </div>

          {error ? (
            <Card solid className="p-6">
              <Alert>{error}</Alert>
              <Button variant="ghost" size="sm" className="mt-4" onClick={request.retry}>
                Try again
              </Button>
            </Card>
          ) : !loading && problems.length === 0 ? (
            <Card solid>
              <EmptyState
                icon="⌕"
                title="No problems match"
                description={
                  narrowed
                    ? "Nothing fits every filter at once. Remove a topic or widen the rating range to see more."
                    : "The library is empty. Import some problems to get started."
                }
                action={
                  narrowed && (
                    <Button variant="primary" size="sm" onClick={clear}>
                      Clear filters
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <ProblemResults problems={problems} loading={loading} signedIn={signedIn} />
          )}

          {total !== null && total > 0 && !error && (
            <Pagination page={filters.page} pageSize={PAGE_SIZE} total={total} onChange={goToPage} />
          )}
        </section>
      </div>
    </div>
  );
}
