"use client";

// The one copy of the learner's history, held for the whole app.
//
// WHY THIS IS A PROVIDER AND NOT A HOOK
// =====================================
// `useHistory` used to own its state, so every screen that called it ran its own
// uncached GET /api/history. Eighteen call sites across the app meant a single
// page could open with several identical requests in flight — the sidebar, the
// feed, and whatever the feed rendered, all asking the server the same question
// at the same time. State that every screen shares is state that belongs above
// every screen, so it moved here: mounted once in the root layout, fetched at
// most once, read by all of them.
//
// FIRST PAINT DOES NOT WAIT ON A FETCH
// ====================================
// The root layout is a Server Component that already knows who is asking, so it
// reads the history there and hands it in as `initial`. That closes the
// waterfall the old hook created (HTML → hydrate → fetch → query → render): the
// data is in the first response, so the first paint is the real screen and there
// is no client request at all.
//
// Two cases are left where nothing is seeded, and each has its own shortcut
// before falling back to the network:
//
//   signed out  — there is no account to read, and a 401 would only send us to
//                 this browser's local progress. So we go straight there. See
//                 store/local-progress.ts for why that is the right source.
//   seed failed — the server could not read the history (an unreadable file is a
//                 503, not an empty history). Paint the last known copy from the
//                 cache if there is one, then ask the server properly.
//
// `initial` is consumed once, at mount. A later render of the layout must not
// push its copy in, because by then a write may have happened and the freshest
// answer is the one we fetched, not the one the router happened to have.
//
// STALENESS IS NOW SOMETHING WE DO ON PURPOSE
// ===========================================
// One shared copy that outlives every navigation has to be told when it is out
// of date, where eighteen private copies each fixed themselves by refetching on
// mount. Writes announce themselves (see history-events.ts) and this provider
// re-reads on hearing one, skipping the request when the screen that wrote has
// already asked for itself.

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  applyCached,
  applyRevalidation,
  outcomeForResponse,
  readCachedHistory,
  seededState,
  writeCachedHistory,
  type HistoryState,
  type RevalidationOutcome,
} from "@/lib/history-cache";
import {
  coveredByRefresh,
  onHistoryWrite,
  WRITE_SETTLE_MS,
} from "@/lib/history-events";
import { loadLocalHistory } from "@/lib/store/local-progress";
import type { HistoryFile } from "@/types";

export interface HistoryContextValue {
  history: HistoryFile;
  loaded: boolean;
  refresh: () => Promise<void>;
  /**
   * Apply a write to the copy on screen, NOW, without asking anyone.
   *
   * This is the second half of "seed it early, sync it late", and the half that
   * was missing. Seeding fixed the FIRST paint; every write after it still cost
   * a round trip to the server and a second one to read the whole history back,
   * with nothing on screen moving until both landed. Claiming a group took about
   * two seconds to acknowledge a click whose outcome we already knew.
   *
   * We know it because the functions that decide it are pure and already
   * shared: history-ops.ts is what the API route applies on the server and what
   * the signed-out path applies in this browser. Handing the SAME op to the copy
   * on screen is not a guess about what the server will say — it is the identical
   * computation, run where the user is.
   *
   * So the post still goes, and the write still announces itself, and the
   * revalidation still lands and wins if it disagrees (see onHistoryWrite
   * below). What changes is that none of that is on the path between the click
   * and the screen.
   */
  apply: (op: (hist: HistoryFile) => HistoryFile) => void;
}

/** Undefined means "no provider above me". `useHistory` turns that into a loud
 * error rather than a silent second fetch — a screen rendering outside the app
 * shell is a bug in the tree, and quietly working would hide it. */
export const HistoryContext = createContext<HistoryContextValue | undefined>(
  undefined,
);

/** One GET, translated into the three answers the app distinguishes (see
 * outcomeForResponse). Kept apart from the state so the fetch has no opinion
 * about what is on screen. */
async function fetchHistory(): Promise<RevalidationOutcome> {
  try {
    const res = await fetch("/api/history", { cache: "no-store" });
    return await outcomeForResponse(res, loadLocalHistory);
  } catch {
    // Offline, or the request never completed. Not an answer, so nothing on
    // screen changes.
    return { kind: "unavailable" };
  }
}

export function HistoryProvider({
  userId,
  initial,
  children,
}: {
  /** The signed-in account, or null for a signed-out visitor. Also the cache
   * key, which is why it is the id and not a boolean. */
  userId: string | null;
  /** The server's read of that account's history, or null when there was none to
   * read (signed out) or it could not be read (503). */
  initial: HistoryFile | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<HistoryState>(() => seededState(initial));

  // Newest answer wins. Two revalidations can overlap (a write's refresh landing
  // beside a screen's), and without this the slower one would be free to
  // overwrite the fresher with older data.
  const generation = useRef(0);

  // When the newest revalidation LEFT. A write that landed before then is
  // already in the answer we are waiting for, which is how a screen's own
  // refresh() saves this provider a second request (see coveredByRefresh).
  const issuedAt = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++generation.current;
    issuedAt.current = Date.now();
    const outcome = await fetchHistory();
    if (mine !== generation.current) return;
    setState((prev) => applyRevalidation(prev, outcome));
    if (userId && outcome.kind === "server") writeCachedHistory(userId, outcome.history);
  }, [userId]);

  // The seed and the account it was read for, frozen at mount. Held in refs
  // because both questions this asks are about mount time: has the seed already
  // been used, and is it still the right account's.
  const seed = useRef(initial);
  const seedUser = useRef(userId);

  useEffect(() => {
    // The seed is already the server's answer for this request, so there is
    // nothing to revalidate — just keep the cache current for the next reload.
    // If the account has changed under us the seed belongs to someone else, so
    // it is skipped and the normal path runs.
    if (seed.current && userId === seedUser.current) {
      if (userId) writeCachedHistory(userId, seed.current);
      return;
    }
    if (!userId) {
      // Signed out: the server told us so on this very request, and the only
      // store that could hold anything is this browser's.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ history: loadLocalHistory(), loaded: true, source: "local" });
      return;
    }
    // Signed in with no seed. Paint the last known copy so the screen is not
    // blank while we ask again; the fetch below replaces it either way.
    const cached = readCachedHistory(userId);
    if (cached) setState((prev) => applyCached(prev, cached));
    void refresh();
  }, [userId, refresh]);

  // Writes go to the server and come back the same way. This is the ear for
  // them: the copy on screen was read before the write, so it re-reads — unless
  // the screen that wrote has already asked for itself, which is the common case
  // and costs nothing here.
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const stop = onHistoryWrite((at) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (coveredByRefresh(issuedAt.current, at)) return;
        void refresh();
      }, WRITE_SETTLE_MS);
      timers.add(timer);
    });
    return () => {
      stop();
      for (const t of timers) clearTimeout(t);
    };
  }, [refresh]);

  // Applied to whatever is on screen at the time, via the updater form: an
  // optimistic write and a revalidation can land in either order, and reading
  // `state.history` from this closure would apply the op to a copy that may
  // already be stale.
  //
  // `loaded` is forced true. A write is a fact about this learner's history that
  // now exists, so the screen must stop saying it does not know yet — otherwise
  // a click during the first revalidation shows a spinner over an answer we are
  // already holding.
  const apply = useCallback((op: (hist: HistoryFile) => HistoryFile) => {
    setState((prev) => ({ ...prev, history: op(prev.history), loaded: true }));
  }, []);

  const value = useMemo<HistoryContextValue>(
    () => ({ history: state.history, loaded: state.loaded, refresh, apply }),
    [state.history, state.loaded, refresh, apply],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}
