"use client";

// One copy of the learner's saved lists for the whole app.
//
// WHY A PROVIDER, NOT A PER-SCREEN HOOK
// =====================================
// This is the mirror of history-provider.tsx, and it exists for the same reason.
// `useLists` used to own its state and fetch on every mount, and the app mounts
// it in eight places — the Library page AND the always-rendered add-to-list
// popover it contains, so a single Library open fired two identical
// GET /api/lists; a list write then re-fetched once per mounted reader. Lists are
// app-wide server JSON exactly like history, so they belong above every screen:
// mounted once in the root layout, seeded from the server on the first paint, and
// read by all. (An older note in the layout said lists needed no provider; the
// duplicate-fetch problem that note predicted for history came for lists too.)
//
// Simpler than HistoryProvider on purpose: history carries optimistic writes that
// must survive a revalidation landing across them, so it has the generation stamp
// and the pending queue. A list write here just posts and re-reads, which is what
// `useLists` already did — the only change is that the state and the re-read are
// shared instead of copied per caller.

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { deleteList as deleteListWrite, postList } from "@/lib/progress-fetch";
import { loadLocalLists } from "@/lib/store/local-progress";
import type { EntryId, SavedList } from "@/types";

export interface ListsContextValue {
  lists: SavedList[];
  loaded: boolean;
  refresh: () => Promise<void>;
  save: (list: SavedList) => Promise<void>;
  addTo: (id: string, entries: EntryId[]) => Promise<void>;
  removeFrom: (id: string, entries: EntryId[]) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  create: (name: string, entries: readonly EntryId[]) => Promise<void>;
}

/** Undefined means "no provider above me". `useLists` turns that into a loud
 * error rather than a silent second fetch, matching HistoryContext. */
export const ListsContext = createContext<ListsContextValue | undefined>(
  undefined,
);

export function ListsProvider({
  userId,
  initial,
  children,
}: {
  /** The signed-in account, or null for a signed-out visitor. */
  userId: string | null;
  /** The server's read of that account's lists, or null when there was none to
   * read (signed out) or it could not be read. */
  initial: SavedList[] | null;
  children: ReactNode;
}) {
  const [lists, setLists] = useState<SavedList[]>(initial ?? []);
  const [loaded, setLoaded] = useState(initial !== null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/lists", { cache: "no-store" });
      if (res.ok) {
        setLists((await res.json()).lists ?? []);
      } else {
        // DRAIN THE BODY on the non-ok paths, as useHistory does: an unread body
        // keeps the request in flight until GC, which stalls network-idle waits
        // (Playwright, for one), and signed out the 401 is the COMMON path.
        await res.text().catch(() => {});
        // 401 = signed out: read this browser's local lists. Signed-out edits
        // fall back to localStorage (see progress-fetch.ts), and this is where
        // they come back into view.
        if (res.status === 401) setLists(loadLocalLists());
      }
    } catch {
      // server unreachable — keep whatever we have
    } finally {
      setLoaded(true);
    }
  }, []);

  // The seed and the account it was read for, frozen at mount.
  const seed = useRef(initial);
  const seedUser = useRef(userId);
  useEffect(() => {
    // Seeded for this account: it is already the server's answer, so there is
    // nothing to fetch. (An account change under us skips the seed and falls
    // through to the normal path.)
    if (seed.current !== null && userId === seedUser.current) return;
    if (!userId) {
      // Signed out: no account to read, the lists live in this browser. Straight
      // to local, no 401 round trip.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLists(loadLocalLists());
      setLoaded(true);
      return;
    }
    // Signed in with no seed: ask the server.
    void refresh();
  }, [userId, refresh]);

  // Every write goes through progress-fetch, so a signed-out edit answered with
  // 401 is applied to this browser's local lists instead of vanishing, and the
  // refresh() that follows re-reads whichever store answered. One reroute, at the
  // one funnel every list mutation already passed through — now shared, so a
  // single re-read updates every reader.
  const save = useCallback(
    async (list: SavedList) => {
      await postList(list);
      await refresh();
    },
    [refresh],
  );
  const addTo = useCallback(
    async (id: string, entries: EntryId[]) => {
      await postList({ addTo: id, entries });
      await refresh();
    },
    [refresh],
  );
  const removeFrom = useCallback(
    async (id: string, entries: EntryId[]) => {
      await postList({ removeFrom: id, entries });
      await refresh();
    },
    [refresh],
  );
  const rename = useCallback(
    async (id: string, name: string) => {
      await postList({ rename: id, name });
      await refresh();
    },
    [refresh],
  );
  const remove = useCallback(
    async (id: string) => {
      await deleteListWrite(id);
      await refresh();
    },
    [refresh],
  );
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

  const value = useMemo<ListsContextValue>(
    () => ({ lists, loaded, refresh, save, addTo, removeFrom, rename, remove, create }),
    [lists, loaded, refresh, save, addTo, removeFrom, rename, remove, create],
  );

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}
