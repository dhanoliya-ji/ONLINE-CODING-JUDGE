import { Link } from "react-router-dom";
import type { RatingPoint } from "../../lib/types";

const W = 600;
const H = 180;
const PAD = { top: 14, right: 12, bottom: 22, left: 40 };

/** Contest rating over time: one point per rated contest. */
export function RatingChart({
  history,
  rating,
  maxRating,
}: {
  history: RatingPoint[];
  rating: number | null;
  maxRating: number | null;
}) {
  if (history.length === 0 || rating == null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-2xl font-bold text-ink-3">Unrated</p>
          <p className="mt-1 text-sm text-ink-2">
            Finish a rated contest, such as the Sunday weekly round, to get a rating.
          </p>
        </div>
        <Link to="/contests" className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
          See contests →
        </Link>
      </div>
    );
  }

  const values = [history[0].old_rating, ...history.map((p) => p.new_rating)];
  const low = Math.floor((Math.min(...values) - 50) / 100) * 100;
  const high = Math.ceil((Math.max(...values) + 50) / 100) * 100;
  const x = (i: number) => PAD.left + (i / Math.max(1, values.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - low) / (high - low)) * (H - PAD.top - PAD.bottom);
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${x(0)},${H - PAD.bottom} ${line} ${x(values.length - 1)},${H - PAD.bottom}`;
  const ticks = [low, Math.round((low + high) / 200) * 100, high];
  const last = history[history.length - 1];
  const delta = last.new_rating - last.old_rating;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-mono text-3xl font-bold text-ink">{rating}</p>
        <p className={`font-mono text-sm ${delta >= 0 ? "text-pass" : "text-fail"}`}>
          {delta >= 0 ? "+" : ""}
          {delta} last contest
        </p>
        <p className="text-xs text-ink-3">
          max {maxRating} · {history.length} rated {history.length === 1 ? "contest" : "contests"}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Rating history: ${values.join(", ")}. Now ${rating}.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[10px]">
              {t}
            </text>
          </g>
        ))}
        <polygon points={area} fill="var(--ember)" opacity="0.12" />
        <polyline points={line} fill="none" stroke="var(--ember)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.slice(1).map((v, i) => (
          <circle key={history[i].contest_id} cx={x(i + 1)} cy={y(v)} r="4" fill="var(--surface)" stroke="var(--ember)" strokeWidth="2">
            <title>{`${history[i].contest_title}: rank ${history[i].rank}, ${history[i].old_rating} → ${history[i].new_rating}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
