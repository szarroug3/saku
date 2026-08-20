"use client";

// Generic fetch-and-cache-by-key hook for the server-lookups.ts actions — same
// undefined-while-loading contract as content-entries.ts's useContentEntry, but
// keyed by an arbitrary JSON-serializable args tuple instead of a bare EntryId.

import { useEffect, useState } from "react";

export function useServerLookup<Args extends readonly unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  args: Args | null,
): T | undefined {
  const key = args ? JSON.stringify(args) : null;
  const [result, setResult] = useState<{ key: string; value: T } | null>(null);

  useEffect(() => {
    if (key === null || args === null) return;
    let alive = true;
    void fn(...args).then((value) => {
      if (alive) setResult({ key, value });
    });
    return () => {
      alive = false;
    };
    // args/fn are represented by `key`; re-running only on key change avoids
    // refetching on every render when the caller passes a fresh array literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return key !== null && result?.key === key ? result.value : undefined;
}
