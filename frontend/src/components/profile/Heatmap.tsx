import { useEffect, useMemo, useRef } from "react";

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Ember intensity per activity level; level 0 is an empty cell. */
const LEVEL_BG = [
  "var(--surface-3)",
  "color-mix(in srgb, var(--ember) 28%, var(--surface-3))",
  "color-mix(in srgb, var(--ember) 50%, var(--surface-3))",
  "color-mix(in srgb, var(--ember) 75%, var(--surface-3))",
  "var(--ember)",
];

function level(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * A year of daily submissions, GitHub-style: one column per week, Sunday
 * at the top. Days are UTC, matching the API.
 */
export function Heatmap({ activity }: { activity: { date: string; submissions: number; accepted: number }[] }) {
  const { weeks, months, total } = useMemo(() => {
    const byDay = new Map(activity.map((a) => [a.date, a]));
    const today = Date.parse(iso(Date.now()));
    // Start on the Sunday 52 weeks before this week's Sunday.
    const thisSunday = today - new Date(today).getUTCDay() * DAY;
    const start = thisSunday - 52 * 7 * DAY;

    const weeks: { date: string; count: number; accepted: number; future: boolean }[][] = [];
    const months: { label: string; column: number }[] = [];
    for (let w = 0; w < 53; w++) {
      const column = [];
      for (let d = 0; d < 7; d++) {
        const time = start + (w * 7 + d) * DAY;
        const date = iso(time);
        const found = byDay.get(date);
        column.push({ date, count: found?.submissions ?? 0, accepted: found?.accepted ?? 0, future: time > today });
      }
      const firstOfMonth = column.find((c) => c.date.endsWith("-01"));
      if (firstOfMonth || w === 0) {
        months.push({ label: MONTHS[Number((firstOfMonth ?? column[0]).date.slice(5, 7)) - 1], column: w });
      }
      weeks.push(column);
    }
    const total = activity.reduce((sum, a) => sum + a.submissions, 0);
    return { weeks, months, total };
  }, [activity]);

  // When the grid is wider than its card, start at the recent end.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">
          <span className="font-mono text-ember">{total}</span> submissions in the past year
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-ink-3" aria-hidden="true">
          Less
          {LEVEL_BG.map((bg) => (
            <span key={bg} className="size-3 rounded-[3px]" style={{ background: bg }} />
          ))}
          More
        </span>
      </div>

      {/* Columns stretch to fill the card. On narrow screens the grid
          scrolls inside its card; the page itself never scrolls sideways. */}
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`Daily activity heatmap: ${total} submissions in the past year`}
          className="grid min-w-[680px] gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
        >
          {months.map((m) => (
            <span
              key={`${m.label}-${m.column}`}
              className="pb-1 text-[10px] leading-none whitespace-nowrap text-ink-3"
              style={{ gridColumn: `${m.column + 1} / span 4`, gridRow: 1 }}
            >
              {m.label}
            </span>
          ))}
          {weeks.map((column, w) =>
            column.map((cell, d) =>
              cell.future ? null : (
                <span
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} submission${cell.count === 1 ? "" : "s"}, ${cell.accepted} accepted`}
                  className="aspect-square rounded-[3px]"
                  style={{ gridColumn: w + 1, gridRow: d + 2, background: LEVEL_BG[level(cell.count)] }}
                />
              ),
            ),
          )}
        </div>
      </div>
    </div>
  );
}
