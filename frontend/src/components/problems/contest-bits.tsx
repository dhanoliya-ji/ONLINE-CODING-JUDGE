import { useEffect, useState } from "react";
import { countdown } from "../../lib/format";
import type { Contest } from "../../lib/types";
import { Badge } from "../ui";

/**
 * A self-ticking countdown. Only this text re-renders each second, rather
 * than the whole page (which would also replay entrance animations).
 */
export function Countdown({ target, onElapsed }: { target: string; onElapsed?: () => void }) {
  const [, setNow] = useState(0);
  useEffect(() => {
    let fired = false;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (!fired && onElapsed && new Date(target).getTime() <= Date.now()) {
        fired = true;
        onElapsed();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [target, onElapsed]);
  return <>{countdown(target)}</>;
}

const STATE_TONE = {
  Running: "pass",
  Upcoming: "info",
  Ended: "muted",
} as const;

export function StateBadge({ state }: { state: Contest["state"] }) {
  return (
    <Badge tone={STATE_TONE[state]}>
      {state === "Running" && (
        <span className="relative flex size-1.5" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {state === "Running" ? "Live" : state}
    </Badge>
  );
}
