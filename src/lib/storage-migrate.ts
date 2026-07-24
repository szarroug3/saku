// One-time, in-place rename of a localStorage key: `kanaquiz-*` → `saku-*`.
//
// WHY THIS EXISTS
// ===============
// Every persisted key in this app used to be namespaced `kanaquiz-` (the legacy
// name). The app is `saku` now, and the keys are being renamed to match. The one
// thing a rename must never do is orphan the data already sitting under the old
// name: the owner has real settings and a real in-progress session on their
// device under `kanaquiz-*`, and a bare rename would read the (absent) new key,
// find nothing, and silently reset them to defaults.
//
// So the rule, applied at every read site, is: prefer the new key; but if the
// new key is absent AND the old key is present, COPY the old value forward to the
// new key once and use it.
//
// IT IS A MOVE, NOT A COPY: once the value is safely under the new key, the old
// key is REMOVED. This matters for any key that can later be removed on purpose —
// a lesson section closed, the claim hint or a concept card reset — because a
// legacy key left lying around would be found again the next time the new key is
// absent and silently re-migrate the very value the removal just cleared. The
// delete is best-effort and only ever runs AFTER a successful copy, so a failed
// setItem can never lose the data.
//
// PURE OF THE BROWSER. The store is passed in, so the whole rule is testable in
// plain Node with a fake store — see storage-migrate.test.ts.

/** The Storage methods the migration needs. `removeItem` is optional so a fake
 * store (or a read-only surface) can omit it; the move degrades to a copy when it
 * is absent. Injected so a test can hand over a plain object and no DOM. */
export interface MigratableStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/**
 * Read `newKey`, migrating the value from `oldKey` on first read if needed.
 *
 *   new key present            → return it, and retire a stale old key if one is
 *                                 still lying beside it (so it can't resurface if
 *                                 the new key is later removed).
 *   new key absent, old present → move old → new (copy, then delete old), return
 *                                 the value.
 *   both absent                 → return null.
 *
 * The move is best-effort and ordered so it cannot lose data: the old key is only
 * deleted AFTER the copy succeeds. If `setItem` throws (private mode, quota) the
 * old value is returned untouched and the migration simply retries next read.
 * Never throws into the caller; a store whose getItem throws yields null (treated
 * as "nothing stored", the safe default every caller already handles).
 */
export function migratedGet(
  store: MigratableStore | null | undefined,
  newKey: string,
  oldKey: string,
): string | null {
  if (!store) return null;
  try {
    const current = store.getItem(newKey);
    if (current !== null) {
      // New key wins. Clean up a legacy key still sitting beside it so a later
      // removal of the new key can't re-migrate the stale value.
      if (store.getItem(oldKey) !== null) tryRemove(store, oldKey);
      return current;
    }
    const legacy = store.getItem(oldKey);
    if (legacy === null) return null;
    try {
      store.setItem(newKey, legacy);
      // Copy succeeded — complete the move.
      tryRemove(store, oldKey);
    } catch {
      // storage full / blocked — return the legacy value anyway; the move retries
    }
    return legacy;
  } catch {
    return null;
  }
}

/** removeItem, swallowing both a missing method and a throwing one. */
function tryRemove(store: MigratableStore, key: string): void {
  try {
    store.removeItem?.(key);
  } catch {
    // best effort — a legacy key that could not be removed is harmless until the
    // new key is next absent, when the move retries
  }
}

/**
 * The whole-word rename of an app-owned key: `kanaquiz-<suffix>` → `saku-<suffix>`.
 * Used both to build the old-key constants beside each new one and by the dynamic
 * intro keys, so the two prefixes can never drift.
 */
export function legacyKey(sakuKey: string): string {
  return sakuKey.startsWith("saku-")
    ? `kanaquiz-${sakuKey.slice("saku-".length)}`
    : sakuKey;
}
