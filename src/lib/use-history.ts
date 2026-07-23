"use client";

// Client-side access to /api/history with a refresh hook. Pages that show
// history-derived data (picker accuracy, sessions, stats) share this.

import { useCallback, useEffect, useState } from "react";

import { loadLocalHistory } from "@/lib/store/local-progress";
import type { HistoryFile } from "@/types";

const EMPTY: HistoryFile = { sessions: [], facts: {} };

export function useHistory() {
  const [history, setHistory] = useState<HistoryFile>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (res.ok) setHistory(await res.json());
      // 401 = signed out (Supabase mode). The account has no history yet, but
      // this browser might: signed-out writes fall back to localStorage (see
      // progress-fetch.ts / local-progress.ts), and this is where they are read
      // back so the screens show them. Without this, every signed-out write
      // would look lost the instant the UI refetched.
      else if (res.status === 401) setHistory(loadLocalHistory());
    } catch {
      // server unreachable — keep whatever we have
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount; state updates land after the awaited response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { history, loaded, refresh };
}

/** Accuracy % over a group of FACTS under `metric`, or null if unseen.
 *
 * Re-exported, not reimplemented: src/lib/accuracy.ts is the one definition of
 * what these numbers mean, and the old local copy here mixed the two
 * denominators. Screens already holding a history can keep the single import. */
export { accuracyFor } from "@/lib/accuracy";
