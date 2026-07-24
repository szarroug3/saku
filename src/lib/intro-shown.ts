// Which concept cards this learner has actually been SHOWN.
//
// WHY A RECORD OF THE CARD, AND NOT A READING OF THE CURRICULUM
// =============================================================
// The three spine cards ("What kanji are", "What a radical is", "What words
// add") are once-ever introductions, so something has to remember that they have
// run. Every earlier attempt asked history instead, and history cannot answer:
//
//   the first cut asked "has this SUBJECT been touched", which a kanji reading
//   unlocked by the lesson's own word answered yes to, on day one.
//
//   the second asked "has the anchor CHARACTER been learned", which is the same
//   question as "have you been shown this card" for a learner starting from
//   zero, and a different question for everybody else. A learner who did the old
//   separate radical track has met 亅. That says she learned a shape. It says
//   nothing about whether anyone ever explained to her what a radical IS, and
//   the owner hit exactly that: prior progress on her real account, and the card
//   silently treated as outgrown.
//
// A card the learner never read is not a card they have outgrown. So the gate is
// the card's own id, recorded when the card has been through a walk.
//
// LOCAL, LIKE EVERY OTHER "SEEN IT ONCE" FLAG IN THIS APP
// =======================================================
// Same shape and same namespace as src/lib/claim-hint.ts: a key per flag, the
// store passed IN rather than reached for, so the rule is pure and testable with
// a plain object and no DOM. The keys are registered in DISMISSIBLE_HINT_KEYS, so
// the Settings knowledge-base reset un-dismisses them and a genuinely restarting
// learner meets the explanations again.
//
// A NEW DEVICE REPLAYS THEM, and that is the safe error in the same direction
// the claim explainer already chose. Showing a three-paragraph card a second
// time costs a learner ten seconds. Not showing it costs them the word "radical",
// which is the failure this file exists to stop.

import {
  introShownKey,
  INTRO_SHOWN,
  oldIntroShownKey,
} from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import { migratedGet } from "@/lib/storage-migrate";

/** The three curriculum concept cards, by intro id.
 *
 * Spelled out here rather than imported from src/data/track-intros.ts on
 * purpose: this module is a leaf that the Settings reset path pulls in, and
 * importing the card DATA would drag the whole phase-intro table along with it.
 * spine-intros.test.ts asserts these are exactly the ids the cards carry, so the
 * two cannot drift apart quietly. */
export const CONCEPT_CARD_IDS: readonly string[] = [
  "track-radical",
  "track-kanji",
  "track-word",
];

/** The localStorage key for one intro's "already shown" flag (renamed
 * `kanaquiz-intro-*` → `saku-intro-*`, its legacy name migrated forward on read).
 * Re-exported from the shared keys module. */
export { introShownKey };

/** Every key this module owns, for the reset sweep. */
export const INTRO_SHOWN_KEYS: readonly string[] = CONCEPT_CARD_IDS.map(introShownKey);

/** The stored value that means "shown". Anything else, including nothing, reads
 * as "still owed", which is the honest default for a learner who has never been
 * here. */
const SHOWN = INTRO_SHOWN;

/** The reader half of a Storage — getItem plus setItem, because reading migrates
 * the legacy value forward on first read (see migratedGet). A test can still pass
 * a plain object. */
type Reader = Pick<Storage, "getItem" | "setItem">;
/** The writer half. */
type Writer = Pick<Storage, "setItem">;

/**
 * Has this card been shown?
 *
 * False on a missing or throwing store (SSR, private mode), because showing an
 * explanation to someone who cannot be remembered is the safe error.
 */
export function isIntroShown(store: Reader | null | undefined, id: string): boolean {
  return migratedGet(store, introShownKey(id), oldIntroShownKey(id)) === SHOWN;
}

/** Every card already shown, as the set the walk gates on. One read per card, so
 * this is cheap enough to call on every render of a lesson. */
export function shownIntros(store: Reader | null | undefined): Set<string> {
  const shown = new Set<string>();
  for (const id of CONCEPT_CARD_IDS) {
    if (isIntroShown(store, id)) shown.add(id);
  }
  return shown;
}

/** Record that a card has been through a walk. Swallows a throwing store: a
 * failed write means the card returns next time, which is a nuisance and not a
 * bug. */
export function markIntroShown(store: Writer | null | undefined, id: string): void {
  try {
    store?.setItem(introShownKey(id), SHOWN);
  } catch {
    // storage unavailable, so the card will simply come back
  }
}

/**
 * Record every concept card in a finished walk.
 *
 * Called when the learner LEAVES the teach phase, and not while they are in it.
 * The walk's steps are derived from this same flag, so writing mid-walk would
 * pull the card out from under the reader and shift every step index behind it.
 * A walk abandoned halfway records nothing, and the card comes back, which is the
 * right answer for someone who never finished reading it.
 *
 * Ids that are not concept cards are ignored, so a caller can hand over a whole
 * walk's intro keys (phase intros, track intros) without filtering first.
 */
export function markConceptCardsShown(
  store: Writer | null | undefined,
  ids: Iterable<string>,
): void {
  let changed = false;
  for (const id of ids) {
    if (CONCEPT_CARD_IDS.includes(id)) {
      markIntroShown(store, id);
      changed = true;
    }
  }
  // Mirror the full shown set to the server once, not per card — a single POST at
  // the end of the walk rather than one per marking. `store` is a Writer here; a
  // full Storage (getItem too) is what real callers pass, so the read-back is
  // safe. Only when something was actually marked.
  if (changed) {
    pushSettings({ introShown: [...shownIntros(store as Reader)] });
  }
}

/** The browser's store, or null where there is not one (SSR, private mode with
 * storage disabled). The one place `window` is touched, so every function above
 * stays pure. */
export function browserStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
