import type { ButtonHTMLAttributes, ReactNode } from "react";
import { DIFFICULTY_CLASSES, TONE_CLASSES, verdictTone } from "../lib/format";
import type { Difficulty } from "../lib/types";

/* ---------------------------------------------------------------- Aurora */

export function AuroraBackdrop() {
  return (
    <>
      <div className="aurora-field" aria-hidden="true">
        <div className="aurora-blob aurora-blob--one" />
        <div className="aurora-blob aurora-blob--two" />
        <div className="aurora-blob aurora-blob--three" />
      </div>
      <div className="aurora-grain" aria-hidden="true" />
    </>
  );
}

/* ----------------------------------------------------------------- Glass */

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
  edge?: boolean;
}) {
  return (
    <div
      className={[
        solid ? "glass-solid" : "glass",
        hover ? "glass-hover" : "",
        edge ? "glass-edge" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Buttons */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
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
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5",
        "text-sm font-semibold text-white",
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.22"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[11px] font-semibold tracking-wide uppercase",
        TONE_CLASSES[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function VerdictBadge({
  verdict,
  className = "",
}: {
  verdict: string;
  className?: string;
}) {
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[11px] font-semibold tracking-wide uppercase",
        DIFFICULTY_CLASSES[difficulty] ?? DIFFICULTY_CLASSES.Easy,
      ].join(" ")}
    >
      <span
        className="size-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      {difficulty}
    </span>
  );
}

/* ------------------------------------------------------------ Feedback */

export function Alert({
  children,
  tone = "fail",
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <div
      role="alert"
      className={[
        "rounded-xl border px-4 py-3 text-sm",
        TONE_CLASSES[tone],
      ].join(" ")}
    >
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
        className="grid size-14 place-items-center rounded-2xl border border-white/12 bg-white/5 text-2xl text-violet-200/70"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-violet-50">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-violet-200/60">{description}</p>
      )}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
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
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-violet-300/70 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-violet-50 sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-violet-200/60">{description}</p>
        )}
      </div>
      {actions}
    </header>
  );
}

/** Metric readout — numbers in monospace so columns of them align. */
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
  const valueColour =
    tone === "pass"
      ? "text-emerald-300"
      : tone === "fail"
        ? "text-rose-300"
        : tone === "warn"
          ? "text-amber-300"
          : tone === "info"
            ? "text-sky-300"
            : "text-violet-50";

  return (
    <Card className="glass-edge p-5" hover>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-violet-300/60 uppercase">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl font-bold tabular-nums ${valueColour}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-violet-200/45">{hint}</p>}
    </Card>
  );
}
