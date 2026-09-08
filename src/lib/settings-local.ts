// The map between the individual localStorage keys (the per-field paint cache)
// and the one server settings blob.
//
// Two directions, both pure (store injected, so testable in plain Node):
//
//   readLocalSettings(store)          — UP. Gather whatever settings this browser
//                                       has under its individual keys into one
//                                       SettingsFile. This is what the one-time
//                                       sign-in migration replays to the server,
//                                       so it includes ONLY fields that are
//                                       actually set (an absent key is not sent,
//                                       so a default never overwrites the server).
//
//   applyServerSettings(store, s)     — DOWN. Write the server's copy back into
//                                       the individual keys, so the readers that
//                                       consult localStorage directly (Practice,
//                                       whose saved recipes and misses live there
//                                       and nowhere else) see the source of
//                                       truth.
//
// Two fields, since the old app's screens went (SAK-374): the config the Settings
// page writes, and Practice's keepsakes. The keys come from settings-keys.ts.
// Nothing here imports the React providers, which is what keeps it out of the
// use-settings → provider → here cycle.

import { CFG_KEY, OLD_CFG_KEY, PRACTICE_MISSES_KEY, PRACTICE_SAVED_KEY } from "@/lib/settings-keys";
import { migratedGet } from "@/lib/storage-migrate";
import type { QuizConfig, SettingsFile } from "@/types";

/** The Storage surface both directions need. Injected so the whole map is
 * testable with a plain object and no DOM. */
export type SettingsStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** JSON.parse that never throws — a bad blob reads as null, the same way every
 * other reader in this app tolerates a hand-edited or half-written value. */
function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Gather this browser's individual settings keys into one SettingsFile, migrating
 * the legacy `kanaquiz-*` config value forward as it reads (migratedGet). Only SET
 * fields are included — an absent key is omitted, never defaulted, so replaying
 * this up to the server cannot overwrite a server value with a local default.
 *
 * Never throws: a throwing store yields whatever was gathered before the throw
 * (in practice, the empty object), which the caller treats as "nothing to
 * migrate".
 */
export function readLocalSettings(store: SettingsStore | null | undefined): SettingsFile {
  const out: SettingsFile = {};
  if (!store) return out;
  try {
    const cfg = parse(migratedGet(store, CFG_KEY, OLD_CFG_KEY));
    if (isPlainObject(cfg)) out.cfg = cfg as unknown as QuizConfig;

    // practice's keepsakes (SAK-342): only when either is set
    const saved = parse(store.getItem(PRACTICE_SAVED_KEY));
    const misses = parse(store.getItem(PRACTICE_MISSES_KEY));
    if (Array.isArray(saved) || isPlainObject(misses)) {
      out.practice = {
        ...(Array.isArray(saved) ? { saved: saved as { name: string; recipe: unknown }[] } : {}),
        ...(isPlainObject(misses) ? { misses: misses as Record<string, number> } : {}),
      };
    }
  } catch {
    // a throwing store — return what we have (the safe, partial answer)
  }
  return out;
}

/** setItem that swallows a throwing store (private mode / quota). */
function set(store: SettingsStore, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    // best effort — the server copy is still the source of truth
  }
}

/**
 * Write the server's settings blob into the individual localStorage keys — the
 * paint cache reconciling down to the source of truth. Only fields the server
 * actually sent are touched; a field the server never stored leaves the local
 * key exactly as it was (which is what lets a brand-new field keep the learner's
 * local choice until a write seeds it upward).
 *
 * Never throws — every write is individually swallowed.
 */
export function applyServerSettings(
  store: SettingsStore | null | undefined,
  settings: SettingsFile,
): void {
  if (!store) return;

  if (settings.cfg !== undefined) set(store, CFG_KEY, JSON.stringify(settings.cfg));

  if (settings.practice !== undefined) {
    if (settings.practice.saved !== undefined) set(store, PRACTICE_SAVED_KEY, JSON.stringify(settings.practice.saved));
    if (settings.practice.misses !== undefined) set(store, PRACTICE_MISSES_KEY, JSON.stringify(settings.practice.misses));
  }
}
