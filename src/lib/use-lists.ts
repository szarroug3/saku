"use client";

// Client-side access to /api/lists. Mirrors use-history.ts deliberately — same
// shape, same refresh, same degradation when the server is unreachable — so
// there is one pattern for "server-owned JSON a screen reads" rather than two.

import { useCallback, useEffect, useState } from "react";

import { deleteList as deleteListWrite, postList } from "@/lib/progress-fetch";
import { loadLocalLists } from "@/lib/store/local-progress";
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
      // 401 = signed out: read this browser's local lists, the mirror of what
      // useHistory does. Signed-out list edits fall back to localStorage (see
      // progress-fetch.ts), and this is where they come back into view.
      else if (res.status === 401) setLists(loadLocalLists());
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

  // Every write below goes through progress-fetch, so a signed-out edit that the
  // server answers with 401 is applied to this browser's local lists instead of
  // vanishing, and the refresh() that follows re-reads whichever store answered
  // (server when signed in, local on 401). One reroute, at the hook every list
  // mutation already funnels through.
  const save = useCallback(
    async (list: SavedList) => {
      await postList(list);
      await refresh();
    },
    [refresh],
  );

  /** Add entries to a FIXED list. The server refuses derived ones; the UI does
   * not offer them. See SavedList's doc for why that is the model and not a
   * quirk. */
  const addTo = useCallback(
    async (id: string, entries: EntryId[]) => {
      await postList({ addTo: id, entries });
      await refresh();
    },
    [refresh],
  );

  /** Drop entries from a FIXED list — the toggle's "off" half, and the per-entry
   * remove on the manage screen. The server refuses derived lists (see
   * removeFromList); the UI only ever calls this for writable ones. */
  const removeFrom = useCallback(
    async (id: string, entries: EntryId[]) => {
      await postList({ removeFrom: id, entries });
      await refresh();
    },
    [refresh],
  );

  /** Relabel a list. Allowed on either kind — a name is not a member — but the
   * manage screen only OFFERS it for writable lists, matching where a person
   * expects to be able to rename. */
  const rename = useCallback(
    async (id: string, name: string) => {
      await postList({ rename: id, name });
      await refresh();
    },
    [refresh],
  );

  /** Delete a whole list. NOT the same as removeFrom — this drops the list
   * itself, entries and all. */
  const remove = useCallback(
    async (id: string) => {
      await deleteListWrite(id);
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

  return { lists, loaded, refresh, save, addTo, removeFrom, rename, remove, create };
}

/**
 * The add-to-list ROW as a toggle, decided from the indicator it already shows.
 *
 * A row's mark is truthful about how many of `entries` are in `list`: ✓ all, –
 * some, blank none. This turns that same fact into the one action a click
 * should take, so the indicator and the behaviour cannot disagree:
 *
 *   all present (✓)  → REMOVE them all (→ blank). The one place a click undoes.
 *   otherwise        → ADD the slice (→ ✓). Empty fills; partial completes.
 *
 * Both underlying writes are idempotent (addToList skips members it has,
 * removeFromList skips ones it hasn't), so handing the WHOLE slice either way is
 * safe — the partial case adds the missing ones without disturbing the present.
 *
 * Pure and free-standing, like countIn: it reads only its arguments, so the
 * popover and its test ask the same function what a click means.
 */
export interface ListToggle {
  kind: "add" | "remove";
  entries: EntryId[];
}

export function listToggle(
  list: SavedList,
  entries: readonly EntryId[],
): ListToggle {
  const have = countIn(list, entries);
  const allPresent = entries.length > 0 && have === entries.length;
  return { kind: allPresent ? "remove" : "add", entries: [...entries] };
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
