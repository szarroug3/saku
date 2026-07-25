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
//                                       consult localStorage directly (the lesson
//                                       sections, the concept cards, the claim
//                                       explainer, and the
//                                       pre-hydration no-flash script on the next
//                                       load) all see the source of truth.
//
// The keys and their stored sentinel values come from settings-keys.ts; the
// concept-card id list comes from intro-shown.ts. Nothing here imports the React
// providers, which is what keeps it out of the use-settings → provider → here
// cycle.

import { CONCEPT_CARD_IDS } from "@/lib/intro-shown";
import {
  ACCENTS_KEY,
  CFG_KEY,
  CLAIM_HINT_DISMISSED,
  CLAIM_HINT_KEY,
  introShownKey,
  INTRO_SHOWN,
  LESSON_OPEN,
  LESSON_READINGS_KEY,
  LESSON_WRITING_KEY,
  OLD_ACCENTS_KEY,
  OLD_CFG_KEY,
  OLD_CLAIM_HINT_KEY,
  OLD_LESSON_READINGS_KEY,
  OLD_LESSON_WRITING_KEY,
  oldIntroShownKey,
  OLD_APPEARANCE_KEY,
  OLD_THEME_KEY,
  THEME_KEY,
  APPEARANCE_KEY,
} from "@/lib/settings-keys";
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
 * each legacy `kanaquiz-*` value forward as it reads (migratedGet). Only SET
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

    const theme = migratedGet(store, THEME_KEY, OLD_THEME_KEY);
    if (theme !== null) out.theme = theme;

    const appearance = migratedGet(store, APPEARANCE_KEY, OLD_APPEARANCE_KEY);
    if (appearance !== null) out.appearance = appearance;

    const accents = parse(migratedGet(store, ACCENTS_KEY, OLD_ACCENTS_KEY));
    if (isPlainObject(accents)) out.accents = accents as Record<string, string>;

    if (migratedGet(store, CLAIM_HINT_KEY, OLD_CLAIM_HINT_KEY) === CLAIM_HINT_DISMISSED) {
      out.claimHintDismissed = true;
    }
    if (migratedGet(store, LESSON_WRITING_KEY, OLD_LESSON_WRITING_KEY) === LESSON_OPEN) {
      out.lessonWriting = true;
    }
    if (migratedGet(store, LESSON_READINGS_KEY, OLD_LESSON_READINGS_KEY) === LESSON_OPEN) {
      out.lessonReadings = true;
    }

    const shown = CONCEPT_CARD_IDS.filter(
      (id) => migratedGet(store, introShownKey(id), oldIntroShownKey(id)) === INTRO_SHOWN,
    );
    if (shown.length) out.introShown = shown;
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

/** removeItem that swallows a throwing store. */
function remove(store: SettingsStore, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // best effort
  }
}

/** Write one boolean flag to its key: the sentinel when true, the key removed
 * when false — so the default reads back correctly whether it was never set or
 * explicitly turned off. Skipped entirely when the server did not send the field. */
function applyFlag(
  store: SettingsStore,
  value: boolean | undefined,
  key: string,
  onValue: string,
): void {
  if (value === undefined) return;
  if (value) set(store, key, onValue);
  else remove(store, key);
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
  if (settings.theme !== undefined) set(store, THEME_KEY, settings.theme);
  if (settings.appearance !== undefined) set(store, APPEARANCE_KEY, settings.appearance);
  if (settings.accents !== undefined) {
    set(store, ACCENTS_KEY, JSON.stringify(settings.accents));
  }

  applyFlag(store, settings.claimHintDismissed, CLAIM_HINT_KEY, CLAIM_HINT_DISMISSED);
  applyFlag(store, settings.lessonWriting, LESSON_WRITING_KEY, LESSON_OPEN);
  applyFlag(store, settings.lessonReadings, LESSON_READINGS_KEY, LESSON_OPEN);

  if (settings.introShown !== undefined) {
    const shown = new Set(settings.introShown);
    for (const id of CONCEPT_CARD_IDS) {
      if (shown.has(id)) set(store, introShownKey(id), INTRO_SHOWN);
      else remove(store, introShownKey(id));
    }
  }
}
