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
//
// SAK-112: THE IN-MEMORY MAP ABOVE ONLY SURVIVES ONE TAB'S SESSION. A hard
// reload or a new tab re-runs this module from scratch, so `cache` starts
// empty again and every lookup — including the ~15,640-entry
// getLibraryShelves() — refetches, even though (per the paragraph above) the
// result can only ever be the SAME value for this build. `persist: true`
// (opt-in, see the `options` param) additionally mirrors a resolved value
// into IndexedDB, keyed by CURRICULUM_VERSION so a new deploy's differently-
// shaped data is never read back as if it were still valid. On mount, a
// persisted call checks IndexedDB BEFORE hitting the network; a hit seeds the
// in-memory cache immediately and skips the Server Action entirely — safe
// because (again per the paragraph above) there is nothing to invalidate
// short of a version bump, which the version-keyed read already handles.
//
// OPT-IN, NOT GENERIC, ON PURPOSE. Most of the ~50 actions in
// server-lookups.ts return small, cheap results (a single entry's href, a
// batch of a dozen facts) where an IndexedDB round trip would be pure
// overhead over just refetching — and every one of them still gets the
// in-memory cache above for free. Only callers who pass `persist: true`
// (today: getLibraryShelves, the one genuinely large/slow payload this ticket
// is about) pay for the extra IndexedDB read/write. Widening this to every
// call site would mean opening a transaction for cache entries nobody is
// reload-sensitive about, for no real benefit.

import { useEffect, useState } from "react";

const cache = new Map<string, unknown>();
// In-flight promises, separate from `cache`, so two components mounting for
// the same (fn, args) in the same tick (or React StrictMode's double-effect
// in dev) share one real fetch instead of firing two.
const pending = new Map<string, Promise<unknown>>();

export interface UseServerLookupOptions {
  /** Also persist a resolved value to IndexedDB (keyed by CURRICULUM_VERSION +
   * this call's cache key) and seed from it on mount, ahead of any network
   * round trip. See the header comment for why this is opt-in. Default false. */
  persist?: boolean;
}

/** The <meta name="curriculum-version"> tag layout.tsx renders server-side
 * (from CURRICULUM_VERSION, @/lib/content/learn-index) — read this way,
 * rather than importing that module directly, so this "use client" hook never
 * pulls the multi-megabyte learn-index.json it wraps into every page's client
 * bundle (see that module's own header on why it isn't `server-only` yet).
 * `null` when absent (SSR, no DOM, or the tag genuinely isn't there) — every
 * caller below treats that as "persistence unavailable" and falls back to the
 * plain in-memory-only behavior. */
function curriculumVersion(): string | null {
  if (typeof document === "undefined") return null;
  return document
    .querySelector('meta[name="curriculum-version"]')
    ?.getAttribute("content") ?? null;
}

const DB_NAME = "saku-server-lookup-cache";
const STORE_NAME = "cache";
const DB_VERSION = 1;

interface StoredEntry {
  key: string;
  version: string;
  value: unknown;
}

function indexedDBAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.indexedDB;
  } catch {
    // Some privacy modes throw on the `indexedDB` getter itself.
    return false;
  }
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** Open (and, on first use, create) the one object store this module needs.
 * Resolves `null` on anything unavailable/unsupported (SSR, a plain-Node test
 * environment with no IndexedDB shim, private-mode restrictions) rather than
 * throwing — every caller below is disposable-cache-only and degrades to
 * "treat as a miss" the same way local-progress.ts's localStorage reads do. */
function openDb(): Promise<IDBDatabase | null> {
  if (!indexedDBAvailable()) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "key" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/** Read a persisted value for `key`, but only when it was written under the
 * CURRENT curriculum version. A stale entry from a previous deploy is deleted
 * on the spot (the "opportunistic cleanup on read" this ticket asks for — no
 * separate GC pass) and read back as a miss, exactly like an absent one. */
async function idbGet(key: string, version: string): Promise<unknown> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as StoredEntry | undefined;
        if (!entry) {
          resolve(undefined);
          return;
        }
        if (entry.version !== version) {
          // Orphaned by a deploy since this was written — same opportunistic
          // cleanup on the write side below.
          store.delete(key);
          resolve(undefined);
          return;
        }
        resolve(entry.value);
      };
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

/** Persist a resolved value under `key`, stamped with the version it was
 * resolved for. `put` (not `add`) so this also overwrites any stale entry
 * left at the same key from a previous version — the write-side half of the
 * opportunistic cleanup `idbGet` does on the read side. */
async function idbSet(key: string, version: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const entry: StoredEntry = { key, version, value };
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function useServerLookup<Args extends readonly unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  args: Args | null,
  options?: UseServerLookupOptions,
): T | undefined {
  // `fn.name` disambiguates different zero/same-shaped-arg actions from each
  // other — every server-lookups.ts export has a distinct name.
  const key = args ? `${fn.name}:${JSON.stringify(args)}` : null;
  const persist = options?.persist ?? false;
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (key === null || args === null || cache.has(key)) return;
    let alive = true;

    async function run(k: string, a: Args) {
      if (persist) {
        const version = curriculumVersion();
        if (version) {
          const stored = await idbGet(k, version);
          // Re-check cache.has: another mount (or the network path below, in
          // a slower tab) may have already resolved this key while the
          // IndexedDB read was in flight.
          if (stored !== undefined && !cache.has(k)) {
            cache.set(k, stored);
            if (alive) forceRender((n) => n + 1);
          }
          if (stored !== undefined) return; // pure function of build content — no fetch needed
        }
      }
      const inFlight = pending.get(k) ?? fn(...a);
      pending.set(k, inFlight);
      const value = await inFlight;
      pending.delete(k);
      if (!cache.has(k)) {
        cache.set(k, value);
        if (alive) forceRender((n) => n + 1);
      }
      if (persist) {
        const version = curriculumVersion();
        if (version) void idbSet(k, version, value);
      }
    }

    void run(key, args);
    return () => {
      alive = false;
    };
    // args/fn/persist are represented by `key` (persist is a static prop of
    // the call site, not something that varies key-to-key); re-running only
    // on key change avoids refetching on every render when the caller passes
    // a fresh array literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return key !== null ? (cache.get(key) as T | undefined) : undefined;
}
