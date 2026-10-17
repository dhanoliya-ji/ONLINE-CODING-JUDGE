import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { Difficulty, Facets } from "../../lib/types";
import { DIFFICULTIES, SOURCES, STATUSES, toggle, type Filters } from "./filters";

const TOP_TAGS = 12;

const DIFFICULTY_DOT: Record<Difficulty, string> = {
  Easy: "bg-pass",
  Medium: "bg-warn",
  Hard: "bg-fail",
};

const STATUS_DOT: Record<string, string> = {
  solved: "bg-pass",
  attempted: "bg-warn",
  todo: "border border-ink-3",
};

const RATING_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "≤ 1200", min: null, max: 1200 },
  { label: "1200–1800", min: 1200, max: 1800 },
  { label: "1800–2400", min: 1800, max: 2400 },
  { label: "2400+", min: 2400, max: null },
];

type Update = (change: Partial<Filters>) => void;

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={id} className="font-mono text-[11px] font-medium tracking-[0.14em] text-ink-3 uppercase">
          {title}
        </h2>
        {aside}
      </div>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {children}
      </div>
    </section>
  );
}

function Count({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  return <span className="font-mono text-[11px] text-ink-3 tabular-nums">{value}</span>;
}

export function FilterPanel({
  filters,
  update,
  facets,
  signedIn,
}: {
  filters: Filters;
  update: Update;
  facets: Facets | null;
  signedIn: boolean;
}) {
  const [allTags, setAllTags] = useState(false);

  const tagFacets = facets?.tags ?? [];
  // Keep selected tags visible even when they are outside the top N.
  const shownTags = allTags
    ? tagFacets
    : tagFacets.filter((tag, index) => index < TOP_TAGS || filters.tags.includes(tag.slug));
  const hiddenCount = tagFacets.length - shownTags.length;

  const sources = facets ? Object.keys(facets.sources) : [...SOURCES];

  return (
    <div className="flex flex-col gap-7">
      <Section title="Difficulty">
        {DIFFICULTIES.map((level) => (
          <button
            key={level}
            type="button"
            className="chip min-h-9"
            aria-pressed={filters.difficulty.includes(level)}
            onClick={() => update({ difficulty: toggle(filters.difficulty, level) })}
          >
            <span className={`size-2 rounded-full ${DIFFICULTY_DOT[level]}`} aria-hidden="true" />
            {level}
            <Count value={facets?.difficulties[level]} />
          </button>
        ))}
      </Section>

      {signedIn && (
        <Section title="Status">
          {STATUSES.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              className="chip min-h-9"
              aria-pressed={filters.status === option.value}
              onClick={() => update({ status: option.value })}
            >
              {option.value && (
                <span className={`size-2 rounded-full ${STATUS_DOT[option.value]}`} aria-hidden="true" />
              )}
              {option.label}
            </button>
          ))}
        </Section>
      )}

      <Section
        title="Topics"
        aside={
          filters.tags.length > 1 && (
            <span className="font-mono text-[11px] text-ink-3">must have all</span>
          )
        }
      >
        {facets === null
          ? Array.from({ length: 10 }).map((_, index) => (
              <span key={index} className="skeleton h-8 w-20 rounded-full" aria-hidden="true" />
            ))
          : shownTags.map((tag) => (
              <button
                key={tag.slug}
                type="button"
                className="chip min-h-8"
                aria-pressed={filters.tags.includes(tag.slug)}
                onClick={() => update({ tags: toggle(filters.tags, tag.slug) })}
              >
                {tag.name}
                <Count value={tag.problem_count} />
              </button>
            ))}
        {facets !== null && tagFacets.length > TOP_TAGS && (
          <button
            type="button"
            onClick={() => setAllTags((open) => !open)}
            aria-expanded={allTags}
            className="inline-flex min-h-8 items-center rounded-full px-2.5 text-[13px] font-medium text-ember-2 hover:text-ember"
          >
            {allTags ? "Show fewer" : `+${hiddenCount} more`}
          </button>
        )}
      </Section>

      <Section title="Source">
        {sources.map((source) => (
          <button
            key={source}
            type="button"
            className="chip min-h-9"
            aria-pressed={filters.source === source}
            onClick={() => update({ source: filters.source === source ? "" : source })}
          >
            {source}
            <Count value={facets?.sources[source]} />
          </button>
        ))}
      </Section>

      <RatingFilter filters={filters} update={update} />
    </div>
  );
}

function RatingFilter({ filters, update }: { filters: Filters; update: Update }) {
  const minId = useId();
  const maxId = useId();

  // Inputs are uncontrolled and remount when the URL changes, so the back
  // button and the presets both show up in them without syncing effects.
  const formKey = `${filters.minRating ?? ""}-${filters.maxRating ?? ""}`;

  function commit(form: HTMLFormElement) {
    const read = (name: string) => {
      const raw = (form.elements.namedItem(name) as HTMLInputElement).value.trim();
      const value = Number.parseInt(raw, 10);
      return raw === "" || !Number.isFinite(value) ? null : Math.max(0, Math.min(5000, value));
    };
    let min = read("min");
    let max = read("max");
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    if (min !== filters.minRating || max !== filters.maxRating) update({ minRating: min, maxRating: max });
  }

  return (
    <Section
      title="Rating"
      aside={
        (filters.minRating !== null || filters.maxRating !== null) && (
          <button
            type="button"
            className="font-mono text-[11px] text-ember-2 hover:text-ember"
            onClick={() => update({ minRating: null, maxRating: null })}
          >
            reset
          </button>
        )
      }
    >
      {RATING_PRESETS.map((preset) => {
        const on = filters.minRating === preset.min && filters.maxRating === preset.max;
        return (
          <button
            key={preset.label}
            type="button"
            className="chip min-h-8 font-mono text-xs"
            aria-pressed={on}
            onClick={() =>
              update(on ? { minRating: null, maxRating: null } : { minRating: preset.min, maxRating: preset.max })
            }
          >
            {preset.label}
          </button>
        );
      })}
      <form
        key={formKey}
        className="mt-1 flex w-full items-center gap-2"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          commit(event.currentTarget);
        }}
        onBlur={(event) => {
          // Commit when focus leaves the pair, not when hopping min → max.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commit(event.currentTarget);
        }}
      >
        <label htmlFor={minId} className="sr-only">
          Minimum rating
        </label>
        <input
          id={minId}
          name="min"
          type="number"
          inputMode="numeric"
          min={0}
          max={5000}
          step={100}
          placeholder="Min"
          defaultValue={filters.minRating ?? ""}
          className="field min-w-0 flex-1 py-2! font-mono text-sm"
        />
        <span className="text-ink-3" aria-hidden="true">
          –
        </span>
        <label htmlFor={maxId} className="sr-only">
          Maximum rating
        </label>
        <input
          id={maxId}
          name="max"
          type="number"
          inputMode="numeric"
          min={0}
          max={5000}
          step={100}
          placeholder="Max"
          defaultValue={filters.maxRating ?? ""}
          className="field min-w-0 flex-1 py-2! font-mono text-sm"
        />
        <button type="submit" className="btn-ghost h-9 shrink-0 rounded-lg px-3 text-xs font-semibold">
          Apply
        </button>
      </form>
    </Section>
  );
}
