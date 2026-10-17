import { Link, useLocation } from "react-router-dom";

/** 404, told the way the judge would tell it: as a verdict on the path. */
export function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="relative mx-auto grid min-h-[70dvh] max-w-[720px] place-items-center px-4 py-16 sm:px-6">
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 size-[min(440px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--glow),transparent_70%)] opacity-70"
        aria-hidden="true"
      />
      <div className="animate-rise relative w-full text-center">
        <p className="font-mono text-[13px] tracking-[0.08em] text-ember [[data-theme=light]_&]:text-ember-2">VERDICT · NOT FOUND</p>
        <p
          className="mt-3 bg-gradient-to-br from-ember-2 to-ember bg-clip-text font-display text-[clamp(5.5rem,20vw,9.5rem)] leading-none font-extrabold tracking-[-0.04em] text-transparent"
          aria-hidden="true"
        >
          404
        </p>
        <h1 className="mt-4 font-display text-[clamp(1.5rem,3.4vw,2rem)] font-bold text-ink">This page melted down.</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-2">
          It does not exist, or it moved. The problem you wanted is probably still in the library.
        </p>

        <div className="panel mx-auto mt-8 max-w-md overflow-hidden rounded-2xl text-left font-mono text-[13px]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <span className="text-ink-2">Test 1</span>
            <span className="rounded-full border border-fail/40 bg-fail/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-fail">
              ✕ WRONG ROUTE
            </span>
          </div>
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 px-4 py-3">
            <dt className="text-ink-2">expected</dt>
            <dd className="text-pass">a page that exists</dd>
            <dt className="text-ink-2">received</dt>
            <dd className="truncate text-ink" title={pathname}>
              {pathname}
            </dd>
          </dl>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary rounded-2xl px-6 py-3 text-[15px] font-semibold">
            Back home
          </Link>
          <Link to="/problems" className="btn-ghost rounded-2xl px-6 py-3 text-[15px] font-medium">
            Browse problems
          </Link>
        </div>
      </div>
    </div>
  );
}
