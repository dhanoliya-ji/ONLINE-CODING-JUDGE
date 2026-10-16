const COLOURS: Record<string, string> = { Easy: "var(--pass)", Medium: "var(--warn)", Hard: "var(--fail)" };
const ORDER = ["Easy", "Medium", "Hard"];

/** Solved problems as a donut, one arc per difficulty, with a legend. */
export function SolvedRing({ progress }: { progress: { difficulty: string; solved: number; total_available: number }[] }) {
  const rows = ORDER.map(
    (difficulty) => progress.find((p) => p.difficulty === difficulty) ?? { difficulty, solved: 0, total_available: 0 },
  );
  const solved = rows.reduce((sum, r) => sum + r.solved, 0);
  const available = rows.reduce((sum, r) => sum + r.total_available, 0);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  // Each arc's length is its share of everything available, so the ring
  // fills up as the library is worked through.
  let offset = 0;
  const arcs = rows.map((r) => {
    const length = available ? (r.solved / available) * circumference : 0;
    const arc = { difficulty: r.difficulty, length, offset };
    offset += length;
    return arc;
  });

  const summary = rows.map((r) => `${r.solved} ${r.difficulty.toLowerCase()}`).join(", ");

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 128 128" className="size-32 shrink-0 -rotate-90" role="img" aria-label={`${solved} solved: ${summary}`}>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="11" />
        {arcs.map((arc) =>
          arc.length > 0 ? (
            <circle
              key={arc.difficulty}
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={COLOURS[arc.difficulty]}
              strokeWidth="11"
              strokeDasharray={`${arc.length} ${circumference}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
            />
          ) : null,
        )}
        <g className="rotate-90" style={{ transformOrigin: "64px 64px" }}>
          <text x="64" y="62" textAnchor="middle" className="fill-ink font-mono text-[26px] font-bold">
            {solved}
          </text>
          <text x="64" y="80" textAnchor="middle" className="fill-ink-3 text-[10px] tracking-widest uppercase">
            solved
          </text>
        </g>
      </svg>

      <ul className="flex-1 space-y-3">
        {rows.map((r) => (
          <li key={r.difficulty}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-2 text-ink-2">
                <span className="size-2 rounded-full" style={{ background: COLOURS[r.difficulty] }} aria-hidden="true" />
                {r.difficulty}
              </span>
              <span className="font-mono text-xs text-ink-3">
                <span className="text-ink">{r.solved}</span> / {r.total_available}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${r.total_available ? Math.min(100, (r.solved / r.total_available) * 100) : 0}%`,
                  background: COLOURS[r.difficulty],
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
