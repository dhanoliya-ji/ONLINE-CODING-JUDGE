import type { Difficulty } from "./types";

/** Verdict → semantic colour + icon. Colour never carries meaning alone. */
export function verdictTone(verdict: string): {
  tone: "pass" | "fail" | "warn" | "info" | "muted";
  icon: string;
} {
  switch (verdict) {
    case "Accepted":
      return { tone: "pass", icon: "✓" };
    case "Wrong Answer":
      return { tone: "fail", icon: "✕" };
    case "Time Limit Exceeded":
      return { tone: "warn", icon: "◴" };
    case "Memory Limit Exceeded":
    case "Output Limit Exceeded":
      return { tone: "warn", icon: "▲" };
    case "Runtime Error":
      return { tone: "fail", icon: "!" };
    case "Compilation Error":
      return { tone: "info", icon: "⌥" };
    case "Pending":
      return { tone: "muted", icon: "◌" };
    default:
      return { tone: "muted", icon: "?" };
  }
}

export const TONE_CLASSES: Record<string, string> = {
  pass: "text-pass bg-pass/12 border-pass/30",
  fail: "text-fail bg-fail/12 border-fail/30",
  warn: "text-warn bg-warn/12 border-warn/30",
  info: "text-info bg-info/12 border-info/30",
  muted: "text-ink-2 bg-surface-2 border-line",
};

export const DIFFICULTY_CLASSES: Record<Difficulty, string> = {
  Easy: "text-pass bg-pass/10 border-pass/25",
  Medium: "text-warn bg-warn/10 border-warn/25",
  Hard: "text-fail bg-fail/10 border-fail/25",
};

/** Plain text colour per difficulty, for tables and inline mentions. */
export const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  Easy: "text-pass",
  Medium: "text-warn",
  Hard: "text-fail",
};

export const LANGUAGE_LABELS: Record<string, string> = {
  python: "Python 3.11",
  c: "C17",
  cpp: "C++17",
  java: "Java 21",
  javascript: "JavaScript (Node 24)",
  typescript: "TypeScript (Node 24)",
  go: "Go 1.24",
  rust: "Rust 1.85",
  ruby: "Ruby 3.3",
  php: "PHP 8.4",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
    ["year", Infinity],
  ];

  let value = seconds;
  for (const [unit, size] of units) {
    if (Math.abs(value) < size) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        -Math.round(value),
        unit,
      );
    }
    value /= size;
  }
  return iso;
}

/** Countdown to (or since) a moment, as a compact H:MM:SS style string. */
export function countdown(target: string): string {
  const delta = new Date(target).getTime() - Date.now();
  const abs = Math.abs(delta);

  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const seconds = Math.floor((abs % 60_000) / 1000);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatMemory(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}
