import { Link } from "react-router-dom";

type Topic = { slug: string; name: string; solved: number; total: number };

const CELL = 46; // tower footprint, px
const GAP = 22;
const MAX_HEIGHT = 120;

/**
 * Topic mastery as a small isometric city: one tower per topic, taller the
 * larger the share of that topic you have solved. Built from CSS 3D faces,
 * not WebGL, so it costs nothing to render and needs no library.
 *
 * The 3D view is decorative (aria-hidden); the list beside it carries the
 * same numbers for screen readers and for reading exact values.
 */
export function TopicSkyline({ topics }: { topics: Topic[] }) {
  const columns = 4;
  const rows = Math.ceil(topics.length / columns);
  const share = (t: Topic) => (t.total ? t.solved / t.total : 0);
  // Heights are relative to the strongest topic, with a floor so every
  // tower is visible, and absolute shares in the labels.
  const best = Math.max(0.0001, ...topics.map(share));

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="relative grid h-72 place-items-center overflow-hidden" aria-hidden="true">
        <div
          className="relative"
          style={{
            width: columns * (CELL + GAP),
            height: rows * (CELL + GAP),
            transformStyle: "preserve-3d",
            transform: "rotateX(58deg) rotateZ(-42deg) translateY(30px)",
          }}
        >
          {topics.map((topic, index) => {
            const height = 10 + (share(topic) / best) * (MAX_HEIGHT - 10);
            const mix = 30 + Math.round((share(topic) / best) * 70);
            const colour = `color-mix(in srgb, var(--ember) ${mix}%, var(--frost))`;
            return (
              <div
                key={topic.slug}
                className="absolute"
                style={{
                  left: (index % columns) * (CELL + GAP),
                  top: Math.floor(index / columns) * (CELL + GAP),
                  width: CELL,
                  height: CELL,
                  transformStyle: "preserve-3d",
                }}
              >
                {/* footprint shadow */}
                <div className="absolute inset-0 rounded-sm" style={{ background: "var(--line-strong)", filter: "blur(3px)" }} />
                {/* roof */}
                <div
                  className="absolute inset-0"
                  style={{ transform: `translateZ(${height}px)`, background: colour, boxShadow: `0 0 18px ${colour}` }}
                />
                {/* south face */}
                <div
                  className="absolute bottom-0 left-0"
                  style={{
                    width: CELL,
                    height,
                    transformOrigin: "bottom",
                    transform: "rotateX(-90deg)",
                    background: `color-mix(in srgb, ${colour} 62%, var(--bg))`,
                  }}
                />
                {/* east face */}
                <div
                  className="absolute top-0 right-0"
                  style={{
                    width: height,
                    height: CELL,
                    transformOrigin: "right",
                    transform: "rotateY(90deg)",
                    background: `color-mix(in srgb, ${colour} 40%, var(--bg))`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <ul className="space-y-2.5">
        {[...topics]
          .sort((a, b) => share(b) - share(a))
          .map((topic) => (
            <li key={topic.slug}>
              <Link to={`/problems?tags=${topic.slug}&status=todo`} className="group block" title={`Practise ${topic.name}`}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-ink-2 group-hover:text-ink">{topic.name}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-3">
                    <span className="text-ink">{topic.solved}</span> / {topic.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-frost to-ember"
                    style={{ width: `${Math.max(2, share(topic) * 100)}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
