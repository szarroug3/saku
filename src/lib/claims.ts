// "I know these" — what it means to the model, and where it is allowed to live.
//
// THE PROBLEM THIS SOLVES, AND THE RULE IT NEARLY BROKE
// ====================================================
// Marking a slice known has to do something the drill can see, or it is a
// button that lies. The obvious implementation — write `lastTested = now` and a
// big `stability` into history.facts — breaks two rules at once, and both are
// load-bearing:
//
//   1. FactState.lastTested is "WRITTEN ONLY BY EVIDENCE — a session you
//      actually answered, at that session's own timestamp. Nothing else may
//      touch it."
//   2. history.facts is DERIVED. deleteSessions() rebuilds it from `sessions`
//      (aggregate.foldSessions), so anything written there that did not come
//      from a session is silently erased the next time you delete one. The claim
//      would work, and then one day it wouldn't, and nothing would say why.
//
// Rule 1 turns out to be about the right thing but not to cover this case. Read
// its own justification: "If browsing a chart, or opening a screen, or the
// passage of time could write here, then the model's clock would measure app
// usage rather than your memory." A deliberate claim is not app usage. It is a
// person stating something about their own memory, which is the only kind of
// thing the model wants and the only kind it otherwise has to infer. It is
// EVIDENCE — self-reported, weaker than a test, and the weakness is expressible.
//
// Rule 2 is absolute, so a claim gets its own key in history.json. It is not
// folded into `facts`, and deleteSessions does not touch it: deleting your
// sessions means throwing away what you DID, and it must not throw away what you
// SAID. They are different records and they now look different on disk.
//
// WHAT A CLAIM IS WORTH
// =====================
// A claim writes no COUNTS. This is the part worth defending: it would be easy
// to record a claim as one seen + one correct, and then the app would report
// "100% over 46 characters" about 46 characters you have never once answered.
// Accuracy is the record of what you DID. You did nothing. So an unpractised,
// claimed fact still reads "—" on every accuracy surface in the app, and that is
// not a gap — it is the truth, and the claim is stated in its own words next to
// it (see standing.ts).
//
// A claim writes a BELIEF, and beliefs decay, which is exactly the property that
// makes this honest. `CLAIMED_DAYS` of stability means the app takes you at your
// word now and grows less sure over months — so "I know all hiragana" removes
// hiragana from your drills today, and does not remove it from the app forever
// on the strength of one click in July. If you were right, you will be asked
// once in the autumn and prove it. If you were wrong, the app finds out.

import { SCORING, UNMET } from "@/lib/scoring";
import type { FactState, HistoryFile } from "@/types";

/** Fact → ms epoch the claim was made. Its own record, beside `sessions` and
 * `facts` in history.json.
 *
 * Defined as the file's own field type rather than restated, so this alias and
 * the stored shape cannot drift apart. */
export type Claims = NonNullable<HistoryFile["claims"]>;

/**
 * How stable a claim makes a fact, in days.
 *
 * 90 is invented, like every other number in the model (see scoring.ts's header
 * — defend the shape, not the numbers). What it is picked to BE is one season:
 * long enough that "I know all hiragana" clears hiragana out of your way for the
 * whole time you would be annoyed to see it, short enough that an untested claim
 * comes back around while you are still using the app.
 *
 * It is deliberately far below what a real streak can reach — `review` compounds
 * by up to ×2.3 per hit, so a genuinely known fact overtakes a claimed one after
 * a few honest answers. A claim is a floor you assert, not a ceiling you buy.
 */
export const CLAIMED_DAYS = 90;

/** The state a claim made at `ts` implies. p is ~1 the moment you claim it and
 * ~37% ninety days later — so a claimed fact is `quiet` (never asked) now, and
 * eventually `probe` (asked once, to check). */
export function claimedState(ts: number): FactState {
  return { stability: CLAIMED_DAYS, lastTested: ts };
}

/**
 * What the model should believe about a fact, given what you did AND what you
 * said.
 *
 * The NEWER record wins, and nothing is merged. That is the whole rule, and it
 * is right in both directions:
 *
 *   - You claim を today, having failed it in March. The claim is newer: the
 *     app believes you. March was true then and is not evidence about now.
 *   - You claim を today and then MISS it in a drill tomorrow. The session is
 *     newer: it folds normally from the claimed state, at p ≈ 1, so the miss is
 *     maximally surprising and takes the full penalty (see review()). Claiming
 *     something and then getting it wrong is the single most informative thing
 *     that can happen, and it costs you exactly what it should. No branch here
 *     does that — `review`'s arithmetic already did.
 *
 * `agg` is Partial because a fact you have claimed and never been tested on has
 * no aggregate at all, which is the common case and not an error.
 */
export function effectiveState(
  agg: Partial<FactState> | undefined,
  claimedAt: number | undefined,
): FactState {
  const tested = agg?.lastTested ?? 0;
  const stability = agg?.stability;
  const fromHistory: FactState =
    typeof stability === "number" && stability > 0 && tested > 0
      ? { stability: Math.max(SCORING.floorDays, stability), lastTested: tested }
      : UNMET;
  if (!claimedAt) return fromHistory;
  if (claimedAt <= tested) return fromHistory;
  return claimedState(claimedAt);
}

// WHY A CLAIM IS NOT A HIT
// ========================
// The tempting implementation of `claimedState` is `review(state, true, now)` —
// reuse the model's one write, let a claim be a correct answer. It is the wrong
// shape, and the reason is the same arithmetic that makes `review` good:
// at p ≈ 1 it multiplies stability by ~1.0. So claiming something you were
// tested on yesterday would do NOTHING AT ALL, and the button would silently
// no-op exactly where a user is likeliest to press it ("yes, I know that one,
// stop asking me"). Newest-record-wins is what makes the button mean the same
// thing everywhere it appears.
