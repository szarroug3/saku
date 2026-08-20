"use client";

// Generic fetch-and-cache-by-key hook for the server-lookups.ts actions — same
// undefined-while-loading contract as content-entries.ts's useContentEntry, but
// keyed by an arbitrary JSON-serializable args tuple instead of a bare EntryId.
//
// PERSISTENTLY CACHED, ON PURPOSE, NO INVALIDATION. Every action in
// server-lookups.ts is a pure function over this BUILD's fixed content data
// (vocab/library-index/learn-index/etc, baked in at build time) — none of
// them take a learner's mutable state (history/claims/progress) as an
// argument; that stays entirely client-side already, via useHistory/
// useLiveFacts/claims, computed instantly with no round trip. So for a given
// loaded page, the SAME (fn, args) pair always resolves to the SAME value —
// there is nothing that could go stale during a session to invalidate. A
// switch back to an already-visited page (Library → Stats → Library) reuses
// the cached result instantly instead of re-fetching and re-flashing
// "Loading…" for data that hasn't changed and can't. A hard reload (a new
// deploy) naturally gets fresh data anyway, since it re-runs this module.

import { useEffect, useState } from "react";

const cache = new Map<string, unknown>();
// In-flight promises, separate from `cache`, so two components mounting for
// the same (fn, args) in the same tick (or React StrictMode's double-effect
// in dev) share one real fetch instead of firing two.
const pending = new Map<string, Promise<unknown>>();

export function useServerLookup<Args extends readonly unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  args: Args | null,
): T | undefined {
  // `fn.name` disambiguates different zero/same-shaped-arg actions from each
  // other — every server-lookups.ts export has a distinct name.
  const key = args ? `${fn.name}:${JSON.stringify(args)}` : null;
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (key === null || args === null || cache.has(key)) return;
    let alive = true;
    const inFlight = pending.get(key) ?? fn(...args);
    pending.set(key, inFlight);
    void inFlight.then((value) => {
      cache.set(key, value);
      pending.delete(key);
      if (alive) forceRender((n) => n + 1);
    });
    return () => {
      alive = false;
    };
    // args/fn are represented by `key`; re-running only on key change avoids
    // refetching on every render when the caller passes a fresh array literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return key !== null ? (cache.get(key) as T | undefined) : undefined;
}
