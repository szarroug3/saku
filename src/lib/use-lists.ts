"use client";

// Client-side access to /api/lists. Mirrors use-history.ts deliberately — same
// shape, same refresh, same degradation when the server is unreachable — so
// there is one pattern for "server-owned JSON a screen reads" rather than two.

import { useCallback, useEffect, useState } from "react";

import type { EntryId, SavedList } from "@/types";

export function useLists() {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/lists", { cache: "no-store" });
      if (res.ok) setLists((await res.json()).lists ?? []);
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

  const save = useCallback(
    async (list: SavedList) => {
      await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(list),
      }).catch(() => {});
      await refresh();
    },
    [refresh],
  );

  /** Add entries to a FIXED list. The server refuses derived ones; the UI does
   * not offer them. See SavedList's doc for why that is the model and not a
   * quirk. */
  const addTo = useCallback(
    async (id: string, entries: EntryId[]) => {
      await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addTo: id, entries }),
      }).catch(() => {});
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await fetch(`/api/lists?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch(() => {});
      await refresh();
    },
    [refresh],
  );

  return { lists, loaded, refresh, save, addTo, remove };
}
