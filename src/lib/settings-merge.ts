// The pure logic of the settings blob: normalise it, merge a partial write into
// it, and reconcile a server copy against a local cache. No fs, no Supabase, no
// DOM — so the server file (settings.ts) and the tests share one definition of
// what these operations MEAN. Same split as history-ops.ts vs history.ts.

import type { PracticeFile, SettingsFile } from "@/types";

/** The keys a SettingsFile carries, spelled once so normalise/merge/empty stay
 * in step as fields are added. */
const SETTINGS_KEYS = ["cfg", "practice"] as const;

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
 * deep merge. Each field is a whole value the client owns (the entire cfg), so a
 * present field in `patch` REPLACES the stored one and an absent field leaves the
 * stored one untouched. `practice` is the one exception, a level deeper; see
 * mergePractice.
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
    if (v === undefined) continue;
    if (key === "practice") {
      next.practice = mergePractice(base.practice, v as PracticeFile);
      continue;
    }
    (next as Record<string, unknown>)[key] = v;
  }
  return next;
}

/**
 * Practice, one level deeper than the rest (SAK-377).
 *
 * Every other field is one thing a learner set on one device, so the last
 * write winning is right. Practice is two: the recipes they saved, and how
 * often each card has been missed. They are written at different moments by
 * whichever device is in front of them, and replacing the pair whole meant a
 * laptop renaming a recipe carried its own stale misses over the ones a phone
 * had just recorded, and the phone's were gone.
 *
 * So each half is taken only when the patch actually speaks to it, and the
 * misses are merged by the LARGER count per card. That is safe because a miss
 * count only ever goes up: `noteMisses` in practice-client.tsx adds one, and
 * nothing anywhere subtracts or clears. If that ever stops being true this has
 * to be rethought, because max would resurrect what was cleared.
 */
function mergePractice(prev: PracticeFile | undefined, patch: PracticeFile): PracticeFile {
  const before: PracticeFile = isPlainObject(prev) ? prev : {};
  const now: PracticeFile = isPlainObject(patch) ? patch : {};
  const out: PracticeFile = { ...before };
  if (now.saved !== undefined) out.saved = now.saved;
  if (now.misses !== undefined) out.misses = mergeMisses(before.misses, now.misses);
  return out;
}

/** The larger count per card, since a miss only ever happens again. */
function mergeMisses(
  prev: Record<string, number> | undefined,
  patch: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = isPlainObject(prev) ? { ...(prev as Record<string, number>) } : {};
  if (!isPlainObject(patch)) return out;
  for (const [id, count] of Object.entries(patch)) {
    if (typeof count !== "number" || !Number.isFinite(count)) continue;
    const had = typeof out[id] === "number" ? out[id] : 0;
    out[id] = Math.max(had, count);
  }
  return out;
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
