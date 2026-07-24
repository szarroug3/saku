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
// new key once and use it. After that first read the value lives under the new
// name and the old key is never consulted again. The old key is deliberately left
// in place rather than deleted — a removeItem buys nothing (the new key now wins)
// and costs a tiny risk of dropping data if the setItem half failed.
//
// PURE OF THE BROWSER. The store is passed in (only getItem/setItem are needed),
// so the whole rule is testable in plain Node with a fake store — see
// storage-migrate.test.ts.

/** The two Storage methods the migration needs. Injected so a test can hand over
 * a plain object and no DOM is required. */
export interface MigratableStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read `newKey`, migrating the value from `oldKey` on first read if needed.
 *
 *   new key present            → return it, ignore the old key entirely.
 *   new key absent, old present → copy old → new (once), return the old value.
 *   both absent                 → return null.
 *
 * The copy-forward is best-effort: if `setItem` throws (private mode, quota), the
 * OLD value is still returned so this read is correct — the migration simply
 * retries on the next read. Never throws into the caller; a store whose getItem
 * throws yields null (treated as "nothing stored", the safe default every caller
 * already handles).
 */
export function migratedGet(
  store: MigratableStore | null | undefined,
  newKey: string,
  oldKey: string,
): string | null {
  if (!store) return null;
  try {
    const current = store.getItem(newKey);
    if (current !== null) return current;
    const legacy = store.getItem(oldKey);
    if (legacy === null) return null;
    try {
      store.setItem(newKey, legacy);
    } catch {
      // storage full / blocked — return the legacy value anyway; the copy retries
    }
    return legacy;
  } catch {
    return null;
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
