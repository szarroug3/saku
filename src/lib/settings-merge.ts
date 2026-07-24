// The pure logic of the settings blob: normalise it, merge a partial write into
// it, and reconcile a server copy against a local cache. No fs, no Supabase, no
// DOM — so the server file (settings.ts) and the tests share one definition of
// what these operations MEAN. Same split as history-ops.ts vs history.ts.

import type { SettingsFile } from "@/types";

/** The keys a SettingsFile carries, spelled once so normalise/merge/empty stay
 * in step as fields are added. */
const SETTINGS_KEYS = [
  "cfg",
  "theme",
  "appearance",
  "accents",
  "claimHintDismissed",
  "lessonWriting",
  "lessonReadings",
  "introShown",
  "latency",
] as const;

/** A plain JSON object — not null, not an array. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Coerce whatever came out of storage/the row into a SettingsFile, keeping only
 * the fields it recognises and dropping anything else. A blob written by an older
 * build, or half-corrupted, reads as a usable (possibly empty) settings object
 * rather than crashing a read — the same tolerance the history/lists normalizers
 * apply. Deep validation of each field is left to the client readers, which
 * already guard every value they use.
 */
export function normalizeSettings(raw: unknown): SettingsFile {
  if (!isPlainObject(raw)) return {};
  const out: SettingsFile = {};
  for (const key of SETTINGS_KEYS) {
    const v = raw[key];
    if (v !== undefined) {
      // Assigned through a loose index because each key's type differs; the field
      // types are enforced where they are produced/consumed, not here.
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

/**
 * Merge a partial write into the stored settings — field-level replace, not a
 * deep merge. Each field is a whole value the client owns (the entire cfg, the
 * entire accent map, the entire shown-intro list), so a present field in `patch`
 * REPLACES the stored one and an absent field leaves the stored one untouched.
 *
 * `undefined` in the patch is treated as "not sent" (skipped), never as "clear
 * this field" — a caller that means to clear a boolean sends `false`, and one
 * that means to empty a list sends `[]`.
 */
export function mergeSettings(prev: SettingsFile, patch: SettingsFile): SettingsFile {
  const base = normalizeSettings(prev);
  const next: SettingsFile = { ...base };
  for (const key of SETTINGS_KEYS) {
    const v = patch[key];
    if (v !== undefined) {
      (next as Record<string, unknown>)[key] = v;
    }
  }
  return next;
}

/**
 * Reconcile the server's copy against the local cache: SERVER WINS on every
 * field it has, and the local cache only fills the gaps the server has not spoken
 * to yet. This is the "source of truth on the server, localStorage is a cache"
 * rule as one function — the moment the server has answered, its value for a
 * field is authoritative and the possibly-stale local one is discarded for that
 * field.
 *
 * `local` fills gaps rather than being ignored outright so a brand-new field the
 * server has never stored still shows the learner's local choice until the next
 * write seeds it upward — which is the migration path, not a conflict.
 */
export function reconcileSettings(
  local: SettingsFile,
  server: SettingsFile,
): SettingsFile {
  return mergeSettings(local, server);
}

/** Nothing set — every field absent. The signal that a server row has never been
 * seeded, which is what gates the one-time local→server migration. */
export function isEmptySettings(s: SettingsFile): boolean {
  const n = normalizeSettings(s);
  return SETTINGS_KEYS.every((k) => n[k] === undefined);
}
