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
// The explainer is the sentence that rides under every lesson card ("Saying you
// know these adds them to your knowledge base…"). The owner's rule: introduce it
// once so a new user learns what "I already know these" does, then take it out
// of the way. One dismissal, shared across every lesson card — so this is a
// single flag, not one per card.

/** The localStorage key. Its own namespace, beside "kanaquiz-cfg". */
export const CLAIM_HINT_KEY = "kanaquiz-claim-hint";

/** The stored value that means "dismissed". Any other value (or none) reads as
 * "still show it" — the honest default for a flag a new user has never touched. */
const DISMISSED = "dismissed";

/** The reader half of a Storage, so a test can pass a plain object. */
type Reader = Pick<Storage, "getItem">;
/** The writer half of a Storage. */
type Writer = Pick<Storage, "setItem">;

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
