"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      return;
    }
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setError(null);
    fetch(url, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((d) => { if (!ac.signal.aborted) setData(d); })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  const refetch = useCallback(() => {
    if (!url) return;
    setError(null);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then(setData)
      .catch((err) => {
        if (err instanceof Error) setError(err.message);
      });
  }, [url]);

  return [data, setData, refetch, error] as const;
}
