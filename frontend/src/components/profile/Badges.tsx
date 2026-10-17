import type { BadgeInfo } from "../../lib/types";

const GLYPHS: Record<string, string> = {
  "first-ac": "✓",
  "solved-10": "10",
  "solved-50": "50",
  "solved-250": "250",
  "solved-1000": "1k",
  "hard-10": "H",
  "streak-7": "7d",
  "streak-30": "30d",
  polyglot: "</>",
  contestant: "★",
  rated: "▲",
};

/** Earned badges glow; the rest show how close you are. */
export function Badges({ badges }: { badges: BadgeInfo[] }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <div>
      <p className="mb-4 text-sm text-ink-3">
        <span className="font-mono text-ink">{earned}</span> of {badges.length} earned
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {badges.map((badge) => (
          <li
            key={badge.id}
            title={badge.description}
            className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center ${
              badge.earned ? "border-ember/40 bg-ember/8" : "border-line"
            }`}
          >
            <span
              className={`grid size-11 place-items-center rounded-full font-mono text-sm font-bold ${
                badge.earned
                  ? "bg-gradient-to-br from-ember to-frost text-ember-ink shadow-[0_0_20px_var(--glow)]"
                  : "bg-surface-3 text-ink-3"
              }`}
              aria-hidden="true"
            >
              {GLYPHS[badge.id] ?? "◆"}
            </span>
            <span className={`text-xs font-semibold ${badge.earned ? "text-ink" : "text-ink-2"}`}>{badge.name}</span>
            <span className="text-[11px] leading-snug text-ink-3">{badge.description}</span>
            {!badge.earned && (
              <span className="h-1 w-full overflow-hidden rounded-full bg-surface-3" aria-label={`${Math.round(badge.progress * 100)}% there`}>
                <span className="block h-full rounded-full bg-ember" style={{ width: `${badge.progress * 100}%` }} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
