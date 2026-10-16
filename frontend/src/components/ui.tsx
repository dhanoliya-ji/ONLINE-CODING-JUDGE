import type { ButtonHTMLAttributes, ReactNode } from "react";
import { DIFFICULTY_CLASSES, TONE_CLASSES, verdictTone } from "../lib/format";
import type { Difficulty } from "../lib/types";

/* -------------------------------------------------------------- Backdrop */

/** The page background: an ember glow over a faint grid. */
export function ForgeBackdrop() {
  return <div className="forge-backdrop" aria-hidden="true" />;
}

/** @deprecated The aurora is gone; kept so older imports keep working. */
export const AuroraBackdrop = ForgeBackdrop;

/* ------------------------------------------------------------------ Logo */

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 10h20l-3 16a3 3 0 0 1-3 2.5h-8A3 3 0 0 1 9 26L6 10Z"
        stroke="var(--ember)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M13 6c0 2 3 2 3 4M18 4c0 2 3 2 3 4"
        stroke="var(--frost)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------- Panels */

export function Card({
  children,
  className = "",
  hover = false,
  solid = false,
  edge = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  solid?: boolean;
  /** @deprecated No longer drawn; accepted for compatibility. */
  edge?: boolean;
}) {
  void edge;
  return (
    <div className={[solid ? "panel" : "glass", hover ? "lift" : "", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Buttons */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        variant === "primary" ? "btn-primary" : "btn-ghost",
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold",
        size === "sm" ? "min-h-8 px-3 text-xs" : "min-h-10 px-5 text-sm",
        className,
      ].join(" ")}
    >
      {loading && <Spinner size={15} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/* ---------------------------------------------------------------- Badges */

export function Badge({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-[11px] font-semibold tracking-wide uppercase",
        TONE_CLASSES[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function VerdictBadge({ verdict, className = "" }: { verdict: string; className?: string }) {
  const { tone, icon } = verdictTone(verdict);
  return (
    <Badge tone={tone} className={className}>
      {/* The glyph means colour is never the only signal. */}
      <span aria-hidden="true">{icon}</span>
      {verdict}
    </Badge>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-[11px] font-semibold tracking-wide uppercase",
        DIFFICULTY_CLASSES[difficulty] ?? DIFFICULTY_CLASSES.Easy,
      ].join(" ")}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {difficulty}
    </span>
  );
}

/* ------------------------------------------------------------- Feedback */

export function Alert({ children, tone = "fail" }: { children: ReactNode; tone?: keyof typeof TONE_CLASSES }) {
  return (
    <div role="alert" className={["rounded-xl border px-4 py-3 text-sm", TONE_CLASSES[tone]].join(" ")}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon = "◇",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div
        className="grid size-14 place-items-center rounded-2xl border border-line bg-surface-2 text-2xl text-ink-2"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-2">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/* -------------------------------------------------------------- Headings */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.22em] text-ember uppercase">{children}</p>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="animate-rise">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

/** Metric readout: numbers in monospace so columns of them align. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "pass" | "fail" | "warn" | "info";
}) {
  const colour = tone ? { pass: "text-pass", fail: "text-fail", warn: "text-warn", info: "text-info" }[tone] : "text-ink";
  return (
    <Card solid hover className="p-5">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-3 uppercase">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </Card>
  );
}
