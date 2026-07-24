// The claim-explainer's one bit of memory: has the user dismissed it?
//
// WHY ITS OWN localStorage KEY, NOT quiz-config
// =============================================
// This is a "seen it once, now leave me alone" flag, not a quiz SETTING. It
// never appears in Settings, it is not part of what a quiz runs with, and
// bundling it into QuizConfig would put a UI-affordance's memory in the object
// the drill is built from. A one-line key of its own keeps it out of that shape
// and — because these functions take the store rather than reaching for
// `window` — keeps the rule PURE and testable without a DOM.
//
// The explainer is the one panel at the top of home saying what claiming does
// ("Say you already know something…"). The owner's rule: introduce it once so a
// new user learns what "I already know these" does, then take it out of the way.
// It speaks for every track at once — kana, kanji, words, grammar — so one flag
// is the whole of its memory.

import {
  CLAIM_HINT_DISMISSED,
  CLAIM_HINT_KEY,
  OLD_CLAIM_HINT_KEY,
} from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import { migratedGet } from "@/lib/storage-migrate";
import { INTRO_SHOWN_KEYS } from "@/lib/intro-shown";

/** The localStorage key (renamed `kanaquiz-claim-hint` → `saku-claim-hint`, its
 * legacy name migrated forward on read). Re-exported for the reset sweep and the
 * tests. */
export { CLAIM_HINT_KEY };

/** The stored value that means "dismissed". Any other value (or none) reads as
 * "still show it" — the honest default for a flag a new user has never touched. */
const DISMISSED = CLAIM_HINT_DISMISSED;

/** The reader half of a Storage — getItem plus setItem, because reading migrates
 * the legacy value forward on first read (see migratedGet). A test can still pass
 * a plain object. */
type Reader = Pick<Storage, "getItem" | "setItem">;
/** The writer half of a Storage. */
type Writer = Pick<Storage, "setItem">;
/** The remover half of a Storage, for the reset sweep below. */
type Remover = Pick<Storage, "removeItem">;

/**
 * The registry of every "seen it once, now leave me alone" intro flag.
 *
 * WHY A REGISTRY AND NOT A PREFIX SWEEP
 * =====================================
 * A reset must un-dismiss every one-time intro so a genuinely-restarting user
 * gets the day-one introductions back — not just today's claim explainer but
 * whatever intro is added next. A prefix sweep ("wipe every saku-*") would
 * be future-proof by accident and dangerous on purpose: it would also erase the
 * theme, the accents, the saved quiz session and the config, none of which are
 * intro flags. So the sweep is EXPLICIT. Each dismissible intro registers its
 * key here, and `clearAllDismissedHints` removes exactly these and nothing else.
 * Adding a new intro is one line in this list — the reset picks it up for free.
 */
export const DISMISSIBLE_HINT_KEYS: readonly string[] = [
  CLAIM_HINT_KEY,
  // The curriculum's three concept cards ("What kanji are", "What a radical is",
  // "What words add"), which remember that they have run. Same species of flag,
  // so the same sweep clears them. See src/lib/intro-shown.ts.
  ...INTRO_SHOWN_KEYS,
];

/**
 * Has the claim explainer been dismissed?
 *
 * Defaults to false on a missing store (SSR, or private-mode throwing), because
 * showing the explainer to someone who can't be remembered is the safe error:
 * they learn what the button does, and the worst case is they dismiss it again.
 */
export function isClaimHintDismissed(store: Reader | null | undefined): boolean {
  return migratedGet(store, CLAIM_HINT_KEY, OLD_CLAIM_HINT_KEY) === DISMISSED;
}

/** Record the dismissal — locally AND to the server (the source of truth). Swallows
 * a throwing store (private mode); the server push is a no-op when no provider is
 * mounted. A failed write just means the hint returns next reload, a nuisance not
 * a bug. */
export function dismissClaimHint(store: Writer | null | undefined): void {
  try {
    store?.setItem(CLAIM_HINT_KEY, DISMISSED);
  } catch {
    // storage unavailable — the hint will simply reappear next time
  }
  pushSettings({ claimHintDismissed: true });
}

/**
 * Un-dismiss every one-time intro, so the app's day-one introductions return.
 *
 * The knowledge-base reset calls this so a restarting user is truly back to day
 * one: history wiped on the server AND every "I dismissed this intro" flag wiped
 * here on the client. Sweeps exactly the keys in DISMISSIBLE_HINT_KEYS — add an
 * intro's key there and it clears here for free. Swallows a throwing store
 * (private mode): a flag that couldn't be removed just stays dismissed, which is
 * a nuisance for that one user, not a bug worth failing the reset over.
 */
export function clearAllDismissedHints(store: Remover | null | undefined): void {
  try {
    for (const key of DISMISSIBLE_HINT_KEYS) store?.removeItem(key);
  } catch {
    // storage unavailable — the flags stay as they are
  }
  // Mirror the un-dismissal to the server so a reset on one device is not undone
  // by the next reconcile from another: the claim explainer and every concept
  // card are owed again.
  pushSettings({ claimHintDismissed: false, introShown: [] });
}
