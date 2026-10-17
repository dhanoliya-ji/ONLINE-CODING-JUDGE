import { useCallback, useEffect, useState } from "react";

/**
 * Fetch whatever `key` describes, keeping the previous result on screen while
 * the next one loads (so a table dims instead of collapsing into skeletons).
 * Loading and error are derived from which key each result belongs to, which
 * also means a slow, stale response can never overwrite a newer one.
 *
 * `load` must be stable (define it at module level); pass `key = null` to wait.
 */
export function useKeyedRequest<T>(key: string | null, load: (key: string) => Promise<T>) {
  const [nonce, setNonce] = useState(0);
  const [success, setSuccess] = useState<{ id: string; value: T } | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);

  const id = key === null ? null : `${nonce}|${key}`;

  useEffect(() => {
    if (key === null || id === null) return;
    let stale = false;
    load(key)
      .then((value) => !stale && setSuccess({ id, value }))
      .catch((err: unknown) =>
        !stale && setFailure({ id, message: err instanceof Error ? err.message : "Request failed" }),
      );
    return () => {
      stale = true;
    };
  }, [id, key, load]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return {
    value: success?.value ?? null,
    loading: id === null || (success?.id !== id && failure?.id !== id),
    error: failure && failure.id === id ? failure.message : null,
    retry,
  };
}
