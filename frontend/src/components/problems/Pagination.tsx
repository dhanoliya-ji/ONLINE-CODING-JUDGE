/** Page numbers to show: always the ends, a window round the current page, gaps as null. */
function pageWindow(current: number, last: number): (number | null)[] {
  const pages = new Set([1, last, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) out.push(null);
    out.push(page);
  });
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  label = "Pagination",
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;

  const step =
    "btn-ghost inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:opacity-40";

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-mono text-xs text-ink-3">
        Page <span className="text-ink-2">{page}</span> of <span className="text-ink-2">{last}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" className={step} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">Previous</span>
          <span className="sr-only sm:hidden">Previous page</span>
        </button>
        {pageWindow(page, last).map((entry, index) =>
          entry === null ? (
            <span key={`gap-${index}`} className="px-1 font-mono text-xs text-ink-3" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onChange(entry)}
              aria-current={entry === page ? "page" : undefined}
              aria-label={`Page ${entry}`}
              className={[
                "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 font-mono text-sm tabular-nums transition-colors",
                entry === page
                  ? "border-ember/50 bg-ember/15 font-semibold text-ink"
                  : "border-transparent text-ink-2 hover:border-line hover:bg-surface-2 hover:text-ink",
                // Phones get just the ends and the current page.
                Math.abs(entry - page) === 1 && entry !== 1 && entry !== last ? "hidden sm:inline-flex" : "",
              ].join(" ")}
            >
              {entry}
            </button>
          ),
        )}
        <button type="button" className={step} disabled={page >= last} onClick={() => onChange(page + 1)}>
          <span className="hidden sm:inline">Next</span>
          <span className="sr-only sm:hidden">Next page</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </nav>
  );
}
