import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { Difficulty, ProblemQuery, ProblemSort } from "../../lib/types";

/**
 * Every problem-browser filter lives in the URL query string, so a filtered
 * view can be shared, survives a reload, and the back button undoes a click.
 *
 *   /problems?q=tree&difficulty=Easy,Medium&tags=graphs,dfs&source=Codeforces
 *            &status=todo&min_rating=1200&max_rating=1800&sort=rating&order=desc&page=2
 */

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];
export const SOURCES = ["Codeforces", "CodeChef", "AtCoder"] as const;
export const STATUSES = [
  { value: "", label: "All" },
  { value: "solved", label: "Solved" },
  { value: "attempted", label: "Attempted" },
  { value: "todo", label: "To do" },
] as const;

export type Status = "" | "solved" | "attempted" | "todo";
export type Order = "asc" | "desc";

export const SORTS: { value: ProblemSort | ""; label: string; searchOnly?: boolean }[] = [
  { value: "", label: "Default" },
  { value: "relevance", label: "Relevance", searchOnly: true },
  { value: "difficulty", label: "Difficulty" },
  { value: "rating", label: "Rating" },
  { value: "acceptance", label: "Acceptance" },
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
];

/**
 * The direction a sort reads most naturally in; the URL only records a flip.
 * Note the API already treats "newest" ascending as newest-first.
 */
export function naturalOrder(sort: ProblemSort | ""): Order {
  return sort === "popular" || sort === "acceptance" || sort === "relevance" ? "desc" : "asc";
}

/** What the current direction means for this sort, in words. */
export function orderLabel(sort: ProblemSort | "", order: Order): string {
  const labels: Partial<Record<ProblemSort | "", [asc: string, desc: string]>> = {
    "": ["Ascending", "Descending"],
    difficulty: ["Easiest first", "Hardest first"],
    rating: ["Lowest first", "Highest first"],
    acceptance: ["Lowest first", "Highest first"],
    popular: ["Least tried first", "Most tried first"],
    newest: ["Newest first", "Oldest first"],
  };
  const pair = labels[sort] ?? ["Ascending", "Descending"];
  return order === "asc" ? pair[0] : pair[1];
}

export const PAGE_SIZE = 25;

export interface Filters {
  q: string;
  difficulty: Difficulty[];
  tags: string[];
  source: string;
  status: Status;
  minRating: number | null;
  maxRating: number | null;
  sort: ProblemSort | "";
  order: Order;
  page: number;
}

const list = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const int = (value: string | null) => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

function parse(params: URLSearchParams): Filters {
  const q = (params.get("q") ?? "").trim();
  const rawSort = params.get("sort") ?? "";
  let sort = (SORTS.some((option) => option.value === rawSort) ? rawSort : "") as ProblemSort | "";
  // Relevance means nothing without a query; fall back rather than confuse the API.
  if (sort === "relevance" && !q) sort = "";
  const rawOrder = params.get("order");
  const status = params.get("status") ?? "";

  return {
    q,
    difficulty: list(params.get("difficulty")).filter((d): d is Difficulty =>
      (DIFFICULTIES as string[]).includes(d),
    ),
    tags: list(params.get("tags")),
    source: params.get("source") ?? "",
    status: (["solved", "attempted", "todo"].includes(status) ? status : "") as Status,
    minRating: int(params.get("min_rating")),
    maxRating: int(params.get("max_rating")),
    sort,
    order: rawOrder === "asc" || rawOrder === "desc" ? rawOrder : naturalOrder(sort),
    page: Math.max(1, int(params.get("page")) ?? 1),
  };
}

function serialise(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.difficulty.length) params.set("difficulty", filters.difficulty.join(","));
  if (filters.tags.length) params.set("tags", filters.tags.join(","));
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.minRating !== null) params.set("min_rating", String(filters.minRating));
  if (filters.maxRating !== null) params.set("max_rating", String(filters.maxRating));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order !== naturalOrder(filters.sort)) params.set("order", filters.order);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

/** Number of narrowing filters in effect (search and sort are not filters). */
export function activeFilterCount(filters: Filters, signedIn: boolean): number {
  return (
    filters.difficulty.length +
    filters.tags.length +
    (filters.source ? 1 : 0) +
    (signedIn && filters.status ? 1 : 0) +
    (filters.minRating !== null || filters.maxRating !== null ? 1 : 0)
  );
}

/** The API query for a set of filters. Status is dropped when signed out. */
export function toQuery(filters: Filters, signedIn: boolean): ProblemQuery {
  return {
    search: filters.q || undefined,
    difficulty: filters.difficulty.length ? filters.difficulty : undefined,
    tags: filters.tags.length ? filters.tags.join(",") : undefined,
    source: filters.source || undefined,
    status: signedIn && filters.status ? filters.status : undefined,
    min_rating: filters.minRating ?? undefined,
    max_rating: filters.maxRating ?? undefined,
    sort: filters.sort || undefined,
    order: filters.order,
    limit: PAGE_SIZE,
    offset: (filters.page - 1) * PAGE_SIZE,
  };
}

export function useProblemFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parse(params), [params]);

  /**
   * Apply a change. Anything that narrows or reorders the list sends the
   * reader back to page 1; `replace` is for keystroke-level updates (search)
   * so typing does not flood the history.
   */
  const update = useCallback(
    (change: Partial<Filters>, options: { replace?: boolean } = {}) => {
      setParams(
        (current) => {
          const base = parse(current);
          const next: Filters = { ...base, ...change };
          if (!("page" in change)) next.page = 1;
          return serialise(next);
        },
        { replace: options.replace },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams((current) => {
      const base = parse(current);
      // Keep the sort: clearing filters should not also reshuffle the list.
      return serialise({
        ...base,
        q: "",
        difficulty: [],
        tags: [],
        source: "",
        status: "",
        minRating: null,
        maxRating: null,
        sort: base.sort === "relevance" ? "" : base.sort,
        page: 1,
      });
    });
  }, [setParams]);

  return { filters, update, clear };
}

export function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}
