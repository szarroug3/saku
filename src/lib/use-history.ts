"use client";

// Client-side access to /api/history with a refresh hook. Pages that show
// history-derived data (picker accuracy, sessions, stats) share this.

import { useCallback, useEffect, useState } from "react";

import type { HistoryFile } from "@/types";

const EMPTY: HistoryFile = { sessions: [], chars: {} };

export function useHistory() {
  const [history, setHistory] = useState<HistoryFile>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (res.ok) setHistory(await res.json());
    } catch {
      // server unreachable — keep whatever we have
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { history, loaded, refresh };
}

/** Accuracy % over a group of chars from the aggregates, or null if unseen. */
export function accuracyFor(
  history: HistoryFile,
  chars: string[],
): number | null {
  let seen = 0;
  let missed = 0;
  for (const c of chars) {
    const a = history.chars[c];
    if (a) {
      seen += a.seen;
      missed += a.missed;
    }
  }
  return seen ? Math.max(0, Math.round((100 * (seen - missed)) / seen)) : null;
}
