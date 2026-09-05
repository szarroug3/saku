"use client";

// Entries fetched from the route's lookup, once each and kept for the
// visit, and fetched ahead when a tile is hovered so a click finds the
// entry ready. What is stored can be amended locally (a claim just made)
// without another fetch.

import { useCallback, useRef, useState } from "react";

export interface Entries<T extends { id: string }> {
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
  const pending = useRef(new Map<string, Promise<T>>());
  const fetch = useCallback((id: string): Promise<T> => {
    const had = pending.current.get(id);
    if (had) return had;
    const p = lookup(id).then((entry) => { setStored((prev) => new Map(prev).set(id, entry)); return entry; });
    p.catch(() => pending.current.delete(id));
    pending.current.set(id, p);
    return p;
  }, [lookup]);
  const peek = useCallback((id: string) => { void fetch(id).catch(() => undefined); }, [fetch]);
  const amend = useCallback((entry: T) => setStored((prev) => new Map(prev).set(entry.id, entry)), []);
  const get = useCallback((id: string) => stored.get(id), [stored]);
  return { get, fetch, peek, amend };
}
