import { useEffect, useState } from "react";

/**
 * The colours the WebGL scene paints with. They come from the CSS theme
 * variables, so the scene follows the light/dark toggle like everything else.
 * This module has no three.js import: it stays in the main bundle while the
 * scene itself is lazy-loaded.
 */
export interface ForgePalette {
  ember: string;
  ember2: string;
  frost: string;
  ink: string;
  surface3: string;
  bg: string;
  /** True when the page background is light, so additive glows would wash out. */
  light: boolean;
}

const FALLBACK: ForgePalette = {
  ember: "#ff8a3d",
  ember2: "#ffb37a",
  frost: "#7fb4ff",
  ink: "#e9ecf4",
  surface3: "#232838",
  bg: "#0a0b10",
  light: false,
};

let normaliser: CanvasRenderingContext2D | null = null;

/** Turns any CSS colour the variables may hold into #rrggbb, which three.js reads reliably. */
function toHex(value: string, fallback: string): string {
  const raw = value.trim();
  if (!raw) return fallback;
  normaliser ??= document.createElement("canvas").getContext("2d");
  if (!normaliser) return fallback;
  normaliser.fillStyle = fallback;
  normaliser.fillStyle = raw;
  const out = String(normaliser.fillStyle);
  return out.startsWith("#") ? out : fallback;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function readPalette(): ForgePalette {
  if (typeof window === "undefined") return FALLBACK;
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => toHex(style.getPropertyValue(name), fallback);
  const bg = read("--bg", FALLBACK.bg);
  return {
    ember: read("--ember", FALLBACK.ember),
    ember2: read("--ember-2", FALLBACK.ember2),
    frost: read("--frost", FALLBACK.frost),
    ink: read("--ink", FALLBACK.ink),
    surface3: read("--surface-3", FALLBACK.surface3),
    bg,
    light: luminance(bg) > 0.5,
  };
}

/**
 * The current palette, re-read whenever <html data-theme> changes. A
 * MutationObserver is used rather than the theme context because the theme
 * provider applies the attribute in its own effect, which runs after ours.
 */
export function useForgePalette(): ForgePalette {
  const [palette, setPalette] = useState(readPalette);

  useEffect(() => {
    const observer = new MutationObserver(() => setPalette(readPalette()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return palette;
}

export function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
