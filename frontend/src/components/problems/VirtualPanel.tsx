import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../../lib/api";
import type { Contest, VirtualStatus } from "../../lib/types";
import { Button } from "../ui";
import { Countdown } from "./contest-bits";

/**
 * Replay a finished contest on your own clock. Your result is scored from
 * your own start and placed among the real final standings.
 */
export function VirtualPanel({ contest }: { contest: Contest }) {
  const [status, setStatus] = useState<VirtualStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .virtualStatus(contest.id)
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setChecked(true));
  }, [contest.id]);

  useEffect(load, [load]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await api.startVirtual(contest.id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not start the replay");
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  if (!status) {
    return (
      <div className="rounded-xl border border-line bg-bg-raised p-4 text-sm">
        <p className="font-semibold text-ink">Replay it as a virtual contest</p>
        <p className="mt-1 text-xs text-ink-2">
          {contest.duration_minutes} minutes on your own clock, scored like the real round and ranked against its final
          standings. No coach or editorials until you finish.
        </p>
        <Button onClick={start} loading={busy} className="mt-3 w-full">
          Start replay
        </Button>
        {error && (
          <p role="alert" className="mt-2 text-xs text-fail">
            {error}
          </p>
        )}
      </div>
    );
  }

  const { entry } = status;
  return (
    <div
      className={`rounded-xl border p-4 text-sm ${status.active ? "border-ember/40 bg-ember/10" : "border-line bg-bg-raised"}`}
      aria-live="polite"
    >
      <p className="font-semibold text-ink">{status.active ? "Your replay is running" : "Your replay"}</p>
      {status.active && (
        <p className="mt-1 font-mono text-xs text-ink-2">
          ends in <Countdown target={status.ends_at} onElapsed={load} />
        </p>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dd className="font-mono text-lg font-bold text-ink">{entry.solved}</dd>
          <dt className="text-[10px] tracking-wider text-ink-3 uppercase">solved</dt>
        </div>
        <div>
          <dd className="font-mono text-lg font-bold text-ink">{entry.penalty}</dd>
          <dt className="text-[10px] tracking-wider text-ink-3 uppercase">penalty</dt>
        </div>
        <div>
          <dd className="font-mono text-lg font-bold text-ember">#{status.virtual_rank}</dd>
          <dt className="text-[10px] tracking-wider text-ink-3 uppercase">of {status.real_participants + 1}</dt>
        </div>
      </dl>
      {status.active && <p className="mt-2 text-xs text-ink-3">Open the problems below to submit to your replay.</p>}
    </div>
  );
}
