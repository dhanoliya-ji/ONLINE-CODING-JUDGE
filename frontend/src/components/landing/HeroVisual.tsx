import { Component, Suspense, lazy, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useForgePalette, usePrefersReducedMotion } from "./palette";
import "./landing.css";

// three.js and react-three-fiber live only in this chunk. It starts loading
// after the hero has painted; the CSS crucible stands in until it is ready.
const ForgeScene = lazy(() => import("./ForgeScene"));

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    // Hand the probe context straight back; browsers cap live contexts.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** If the scene chunk fails to load or the context cannot be created, keep the CSS version. */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The hero's right-hand visual: a WebGL crucible with HTML code and verdict
 * cards floating over it. Purely decorative, so hidden from assistive tech.
 */
export function HeroVisual() {
  const box = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const palette = useForgePalette();
  const reduced = usePrefersReducedMotion();
  const [webgl] = useState(detectWebGL);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState === "visible");

  // Pause rendering while the hero is scrolled away...
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ...and while the tab is in the background.
  useEffect(() => {
    const onChange = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  // Pointer parallax. The position goes into a ref (read by the scene each
  // frame) and two CSS variables (read by the cards), so moving the mouse
  // never re-renders React.
  useEffect(() => {
    const el = box.current;
    if (!el || reduced) {
      pointer.current = { x: 0, y: 0 };
      el?.style.setProperty("--px", "0");
      el?.style.setProperty("--py", "0");
      return;
    }
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const clamp = (v: number) => Math.max(-1, Math.min(1, v));
        const x = clamp(((event.clientX - (rect.left + rect.width / 2)) / window.innerWidth) * 2);
        const y = clamp(((event.clientY - (rect.top + rect.height / 2)) / window.innerHeight) * 2);
        pointer.current = { x, y };
        el.style.setProperty("--px", x.toFixed(3));
        el.style.setProperty("--py", y.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduced]);

  const useScene = webgl && !failed;
  const frameloop = reduced ? "demand" : inView && tabVisible ? "always" : "never";

  return (
    <div ref={box} aria-hidden="true" className="relative h-[360px] w-full sm:h-[460px] lg:h-[540px]">
      {/* CSS crucible: shown while the scene loads, and kept if WebGL is unavailable. */}
      <div className="forge-css" style={{ opacity: useScene && ready ? 0 : 1 }}>
        <div className="forge-css-stage">
          <div className="forge-css-ring c" />
          <div className="forge-css-ring b" />
          <div className="forge-css-core" />
          <div className="forge-css-ring a" />
        </div>
      </div>

      {useScene && (
        <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: ready ? 1 : 0 }}>
          <SceneBoundary onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <ForgeScene
                palette={palette}
                frameloop={frameloop}
                still={reduced}
                pointer={pointer}
                onReady={() => setReady(true)}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      )}

      <FloatingCards />
    </div>
  );
}

function depth(px: number, turn = 0): CSSProperties {
  return { "--depth": `${px}px`, "--turn": `${turn}deg` } as CSSProperties;
}

function FloatingCards() {
  return (
    <div className="pointer-events-none absolute inset-0 select-none" style={{ perspective: "1100px" }}>
      <div className="parallax absolute top-[6%] left-0 sm:left-[2%]" style={depth(-22, 12)}>
        <div className="float-1 glass px-4 py-3 font-mono text-[12px] leading-relaxed text-ink-2 shadow-2xl shadow-black/30 sm:text-[13px]">
          <div>
            <span className="text-frost">def</span> <span className="text-ink">solve</span>(nums, k):
          </div>
          <div className="pl-4">
            seen = <span className="text-ember-2">{"{}"}</span>
          </div>
          <div className="pl-4">
            <span className="text-frost">for</span> i, x <span className="text-frost">in</span> …
          </div>
        </div>
      </div>

      <div className="parallax absolute top-[18%] right-0 hidden sm:block" style={depth(-12, -14)}>
        <div className="float-2 glass px-4 py-3 font-mono text-[13px] text-ink-2">
          <span className="text-frost">#include</span> &lt;bits/stdc++.h&gt;
        </div>
      </div>

      <div className="parallax absolute right-0 bottom-[8%] sm:right-[5%]" style={depth(-28, -8)}>
        <div className="float-3 flex items-center gap-3 rounded-2xl border border-pass/40 bg-surface/85 px-4 py-3 shadow-[0_24px_60px_-20px_color-mix(in_srgb,var(--pass)_45%,transparent)] backdrop-blur-md">
          <span className="grid size-8 place-items-center rounded-full bg-pass/15 text-pass">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5 10 17l9-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="font-mono text-[12px] text-ink-2 sm:text-[13px]">
            <div className="font-semibold tracking-wide text-pass">ACCEPTED</div>
            12 / 12 tests · 42 ms
          </div>
        </div>
      </div>

      <div className="parallax absolute bottom-[14%] left-[6%] hidden sm:block" style={depth(-8, 10)}>
        <div className="float-1 glass rounded-xl px-3.5 py-2 font-mono text-[12px] text-ink-2">
          Dynamic Programming · <span className="text-warn">Medium</span>
        </div>
      </div>
    </div>
  );
}
