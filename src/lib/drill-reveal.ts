// The wrong-answer / skip reveal (SAK-50) and the audio-prompt text fallback
// (SAK-51), pulled out of drill-screen.tsx for the same reason
// session-accuracy.ts gives: branching logic buried in a .tsx cannot be unit
// tested here (the runner has no JSX transform).

/** The three things a resolved showing can be. "good" is the 650ms
 * auto-advance and never reveals — there is nothing to compare when you got
 * it right. "bad" is an out-of-retries miss. "skip" is the deferral SAK-50
 * gave a reveal to: it used to jump straight to the next card with no
 * indication of what the answer was, which made "I don't know this, skip"
 * the one path through the app that taught nothing. */
export type RevealFeedbackKind = "good" | "bad" | "skip";

export interface RevealFeedback {
  kind: RevealFeedbackKind;
}

/**
 * Whether the drill is paused on a reveal-eligible stop: an out-of-retries
 * miss, or a skip. Both leave the card on screen with nothing left to do but
 * read the answer and press on — the state the Continue button and the
 * showAnswer reveal key off. A "good" pause (the correct-answer auto-advance)
 * is deliberately excluded: it already tells you what you needed to know by
 * turning green.
 */
export function isRevealPause(
  feedback: RevealFeedback | null | undefined,
  waiting: boolean,
): boolean {
  return waiting && (feedback?.kind === "bad" || feedback?.kind === "skip");
}

/**
 * What the learner answered, as one display string — the same precedence
 * submit() already used to decide what goes in `saidByPhrase` (a recognition
 * pick, then an MC option's label, then typed text), named and pulled out so
 * it has one definition instead of being reconstructed at each call site.
 *
 * A timeout (`given === "(time)"`, filtered upstream into `typedSaid: null`)
 * and a skip with no attempt yet both resolve every field null here, which is
 * the honest answer: nothing was said, so the reveal has nothing to put next
 * to the correct answer.
 */
export function resolveAnsweredText(opts: {
  recognitionSaid?: string | null;
  mcSaid?: string | null;
  typedSaid?: string | null;
}): string | null {
  return opts.recognitionSaid ?? opts.mcSaid ?? opts.typedSaid ?? null;
}

/**
 * Whether an audio-prompt showing should still hide its glyph behind the
 * speaker (SAK-51). `listen` is the card's real, graded shape — untouched by
 * this — and audio still autoplays regardless. `textRevealed` is the one new
 * per-showing flag "Show text" sets, so a learner who cannot hear the prompt
 * (muted device, no TTS voice, hard of hearing) has a self-service way off a
 * card that used to be answerable only by finding the drill-settings toggle.
 */
export function effectiveListen(listen: boolean, textRevealed: boolean): boolean {
  return listen && !textRevealed;
}
