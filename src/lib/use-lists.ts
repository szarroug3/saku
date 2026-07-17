"use client";

// Client-side access to /api/lists. Mirrors use-history.ts deliberately — same
// shape, same refresh, same degradation when the server is unreachable — so
// there is one pattern for "server-owned JSON a screen reads" rather than two.

import { useCallback, useEffect, useState } from "react";

import type { EntryId, SavedList } from "@/types";

/**
 * Can you add to it? The one question the two kinds answer differently, asked
 * as a function so that no call site re-derives it from `kind` and gets the
 * polarity backwards.
 *
 * The server refuses a write to a derived list at the one place a write can
 * happen (see lists.ts); this is the UI's half of the same rule, and it exists
 * so the popover can decline to OFFER what the server would refuse. Two guards,
 * one model — the server's is the one that must be right.
 */
export function isWritable(
  list: SavedList,
): list is Extract<SavedList, { kind: "fixed" }> {
  return list.kind === "fixed";
}

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

  /** Mint a new fixed list from a slice. `origin: "manual"` — a list you named
   * here and a deck you imported are the same object and differ only in where
   * their first members came from. */
  const create = useCallback(
    async (name: string, entries: readonly EntryId[]) => {
      await save({
        kind: "fixed",
        id: `list-${Date.now().toString(36)}`,
        name: name.trim(),
        created: Date.now(),
        entries: [...entries],
        origin: "manual",
      });
    },
    [save],
  );

  return { lists, loaded, refresh, save, addTo, remove, create };
}

/** How many of `entries` are already in `list` — the popover's tick/dash/blank.
 * Free function rather than a hook member: it reads nothing but its arguments,
 * and a caller holding a list already has everything it needs. */
export function countIn(
  list: SavedList,
  entries: readonly EntryId[],
): number {
  if (!isWritable(list)) return 0;
  const have = new Set<EntryId>(list.entries);
  let n = 0;
  for (const e of entries) if (have.has(e)) n++;
  return n;
}
