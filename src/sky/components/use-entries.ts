"use client";

// Entries fetched from the route's lookup, once each and kept for the
// visit, and fetched ahead when a tile is hovered so a click finds the
// entry ready. What is stored can be amended locally (a claim just made)
// without another fetch.
//
// KEPT PER LOOKUP. The route makes a new lookup when the history it reads
// changes (a claim, signed out, lands in the browser's copy). The fetches
// made through the old one carry the old standings, so they are let go:
// the Atlas refetched the open entry after "I know this", got the copy from
// before the claim, and drew it back over the claim as Undiscovered.

import { useCallback, useRef, useState } from "react";

interface Entries<T extends { id: string }> {
  get: (id: string) => T | undefined;
  /** Fetch, or return what is already fetched or in flight. */
  fetch: (id: string) => Promise<T>;
  /** Fetch ahead, quietly. */
  peek: (id: string) => void;
  /** Amend what is stored for an entry. */
  amend: (entry: T) => void;
}

export function useEntries<T extends { id: string }>(lookup: (id: string) => Promise<T>): Entries<T> {
  const [stored, setStored] = useState<ReadonlyMap<string, T>>(() => new Map());
  const pending = useRef({ lookup, fetches: new Map<string, Promise<T>>() });
  const fetch = useCallback((id: string): Promise<T> => {
    if (pending.current.lookup !== lookup) pending.current = { lookup, fetches: new Map() };
    const fetches = pending.current.fetches;
    const had = fetches.get(id);
    if (had) return had;
    const p = lookup(id).then((entry) => { setStored((prev) => new Map(prev).set(id, entry)); return entry; });
    p.catch(() => fetches.delete(id));
    fetches.set(id, p);
    return p;
  }, [lookup]);
  const peek = useCallback((id: string) => { void fetch(id).catch(() => undefined); }, [fetch]);
  const amend = useCallback((entry: T) => setStored((prev) => new Map(prev).set(entry.id, entry)), []);
  const get = useCallback((id: string) => stored.get(id), [stored]);
  return { get, fetch, peek, amend };
}
