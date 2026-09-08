// One pass over this browser's storage, removing what belongs to features that
// no longer exist.
//
// WHY SWEEP AT ALL
// ================
// Nothing reads these keys, so nothing is broken by leaving them. What they cost
// is honesty: a learner's browser holds a theme for a picker that is gone, an
// in-progress run for a quiz that cannot be resumed, and nine "you have read
// this card" flags for a registry that was deleted. Anyone opening the storage
// inspector reads a version of this app that has not existed for weeks, and
// every one of those keys would be re-migrated forward by the next shim someone
// writes. So they go, once, on the first render that has a browser.
//
// It runs on every load rather than recording that it has run. `removeItem` on
// an absent key is a no-op, so the second load is a handful of misses on a hash
// map; a "swept" marker would be one more dead key a year from now, which is
// the thing this file exists to remove.
//
// PURE OF THE BROWSER, mostly: the store is injected, so the rule is testable in
// plain Node with a fake. The cookie is the exception, and it is handled apart
// (a cookie is not in Storage and is cleared by expiring it).
//
// WHAT IS NOT HERE, and why:
//   saku-cfg, sky:practice:recipes, sky:practice:misses: live settings.
//   saku-local-history, saku-local-lists: a signed-out visitor's own progress
//     and lists, still written by store/local-progress.ts.
//   saku-history-cache:*, sky:quiz:rest: live caches.
//   saku-server-lookup-cache: an IndexedDB database, not a Storage key, so it is
//     out of this sweep's reach. Its module went with the old app; the database
//     is the owner's to drop.

/** The Storage surface the sweep needs: enough to walk the keys and drop one. */
export interface SweepStore {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/** Keys of features that are gone, by exact name. */
export const DEAD_KEYS: readonly string[] = [
  // the theme, the appearance and the per-theme accents (SAK-374)
  "saku-theme",
  "saku-appearance",
  "saku-accents",
  // the claim explainer and the two lesson-section folds (SAK-374)
  "saku-claim-hint",
  "saku-lesson-writing",
  "saku-lesson-readings",
  // the in-progress run and its sync envelope: the old quiz cannot be resumed
  "saku-session",
  "saku-session-sync",
  // the unsent-record outbox, whose module went with the old app
  "saku-pending-records",
];

/** Keys of features that are gone, by prefix: every once-ever concept card's
 * "already shown" flag, and every key still under the pre-rename namespace,
 * which nothing has read since the `kanaquiz-*` shim went (SAK-378). */
export const DEAD_PREFIXES: readonly string[] = ["saku-intro-", "kanaquiz-"];

/** Remove every dead key, and answer how many were actually there. Never throws:
 * a store that refuses (private mode, a browser blocking site data) leaves
 * whatever it likes in place, which costs nothing. */
export function sweepDeadKeys(store: SweepStore | null | undefined): number {
  if (!store) return 0;
  const doomed: string[] = [];
  try {
    // Collected first, removed after: removing during the walk renumbers the
    // keys under it and would skip every other match.
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key === null) continue;
      if (DEAD_KEYS.includes(key) || DEAD_PREFIXES.some((p) => key.startsWith(p))) {
        doomed.push(key);
      }
    }
  } catch {
    return 0;
  }
  let gone = 0;
  for (const key of doomed) {
    try {
      store.removeItem(key);
      gone++;
    } catch {
      // best effort, key by key
    }
  }
  return gone;
}

/** The one dead COOKIE: a server-readable hint about the in-progress run, for a
 * sidebar link that no longer exists. Nothing sets it any more, so without this
 * it would ride every request to the app forever. Expired rather than removed,
 * which is the only way a cookie goes. */
export function sweepDeadCookie(doc: { cookie: string } | null | undefined): void {
  if (!doc) return;
  try {
    if (!doc.cookie.includes("saku-current-run-count=")) return;
    doc.cookie = "saku-current-run-count=; Max-Age=0; path=/; SameSite=Lax";
  } catch {
    // best effort
  }
}
