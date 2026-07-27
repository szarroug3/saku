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
import {
  dequeuePending,
  enqueuePending,
  type PendingWrite,
} from "@/lib/history-pending";
import {
  advanceGeneration,
  INITIAL_GENERATION,
  revalidationWins,
  settleRevalidation,
} from "@/lib/history-sync";
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
   *
   * Returns a `settle` the caller invokes when this write's post resolves. Until
   * then the op is held in a pending queue and folded over any revalidation that
   * lands, so a server read that has not yet caught up to this un-acknowledged
   * write cannot erase it (see history-pending.ts). Calling `settle` drops it
   * from that queue — the write is now the server's, or (on a refusal) about to
   * be reverted by the caller's refresh.
   */
  apply: (op: (hist: HistoryFile) => HistoryFile) => () => void;
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

  // The monotonic stamp that decides which read is allowed to land (see
  // history-sync.ts). Two revalidations can overlap (a write's refresh landing
  // beside a screen's), and — the case that made claims revert — a revalidation
  // can be in flight across an optimistic write. Both a newer read AND a local
  // write advance this, and a read may only land if it has not been advanced past
  // since it left. So a read that predates our own write can no longer clobber it.
  const generation = useRef(INITIAL_GENERATION);

  // When the newest revalidation LEFT. A write that landed before then is
  // already in the answer we are waiting for, which is how a screen's own
  // refresh() saves this provider a second request (see coveredByRefresh).
  const issuedAt = useRef(0);

  // The un-acknowledged optimistic writes, oldest first. `apply` enqueues; the
  // caller's `settle` (returned by apply) dequeues when the post resolves. A
  // revalidation that replaces the copy on screen folds these back on first, so
  // a server read that has not yet caught up to a write we have already made
  // cannot erase it (see history-pending.ts / settleRevalidation). `pendingId`
  // just mints the stable id each write removes itself by.
  const pending = useRef<PendingWrite[]>([]);
  const pendingId = useRef(0);

  const refresh = useCallback(async () => {
    const mine = generation.current = advanceGeneration(generation.current);
    issuedAt.current = Date.now();
    const outcome = await fetchHistory();
    // Read the stamp ONCE, after the await: a local write (or a newer read) that
    // happened while we were fetching has moved it, and this read must then lose.
    const won = revalidationWins(mine, generation.current);
    // Fold the still-pending writes read AFTER the await too: an apply that
    // enqueued while we were fetching must be layered on the snapshot we bring
    // back, or it would be the very write this read erases.
    setState((prev) =>
      settleRevalidation(prev, mine, generation.current, outcome, pending.current),
    );
    // The cache is the server's answer WITHOUT our un-acked overlay: it is the
    // durable truth, and the next reload will re-apply whatever writes are still
    // pending then. Caching the folded copy would persist a write the server has
    // not confirmed.
    if (won && userId && outcome.kind === "server") writeCachedHistory(userId, outcome.history);
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
    // Advance the stamp FIRST. A revalidation already in flight left before this
    // write and cannot contain it, so if it were allowed to land afterwards it
    // would revert exactly what we just applied — the claim that advanced the
    // card and then snapped back. Advancing here drops those stale-relative-to-us
    // reads (see revalidationWins in history-sync.ts); a read issued after this
    // still wins, which is how a refused write or a newer device's write corrects
    // us.
    generation.current = advanceGeneration(generation.current);
    // Enqueue the op as an un-acknowledged write. A read issued AFTER this one
    // passes the stamp guard, so the stamp alone would let it land a snapshot the
    // server has not yet caught up to (the seen of a claim revalidating before
    // the claim post commits). Folding this op over any such snapshot keeps the
    // write on screen until its post resolves (see history-pending.ts).
    const id = (pendingId.current += 1);
    pending.current = enqueuePending(pending.current, id, op);
    setState((prev) => ({ ...prev, history: op(prev.history), loaded: true }));
    // The caller settles when the post resolves (ok OR refused): the op leaves
    // the overlay either way — the server now holds it, or the caller's refresh
    // is about to revert it. A THROWN post (offline, still going to land) never
    // settles, so the overlay keeps the change on screen until it does.
    return () => {
      pending.current = dequeuePending(pending.current, id);
    };
  }, []);

  const value = useMemo<HistoryContextValue>(
    () => ({ history: state.history, loaded: state.loaded, refresh, apply }),
    [state.history, state.loaded, refresh, apply],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}
