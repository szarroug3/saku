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

import { INTRO_SHOWN_KEYS } from "@/lib/intro-shown";

/** The localStorage key. Its own namespace, beside "kanaquiz-cfg". */
export const CLAIM_HINT_KEY = "kanaquiz-claim-hint";

/** The stored value that means "dismissed". Any other value (or none) reads as
 * "still show it" — the honest default for a flag a new user has never touched. */
const DISMISSED = "dismissed";

/** The reader half of a Storage, so a test can pass a plain object. */
type Reader = Pick<Storage, "getItem">;
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
 * whatever intro is added next. A prefix sweep ("wipe every kanaquiz-*") would
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
  try {
    return store?.getItem(CLAIM_HINT_KEY) === DISMISSED;
  } catch {
    return false;
  }
}

/** Record the dismissal. Swallows a throwing store (private mode) — a failed
 * write just means the hint returns next reload, which is a nuisance, not a bug. */
export function dismissClaimHint(store: Writer | null | undefined): void {
  try {
    store?.setItem(CLAIM_HINT_KEY, DISMISSED);
  } catch {
    // storage unavailable — the hint will simply reappear next time
  }
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
}
