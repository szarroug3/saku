// Pitch accent as ONE MORE WORD-QUIZ QUESTION (SAK-128) — folded into the
// existing drill's japanese-source, jp2en MEANING card, never a track of its
// own (SAK-98 already ruled that out: "Pitch is a property of a WORD, not a
// separate subject/track... No quiz"). This is the pure, data-only half:
// deciding WHICH of two mechanics a given word's pitch question uses, and
// gathering what it takes to render one. src/components/quiz/drill-screen.tsx
// is the one place that turns a `PitchShowing` into two tappable audio
// buttons and grades the pick — no React, no fetch, no clock here, so the
// decision itself is unit-tested directly, the same discipline
// src/lib/ask-forms.ts documents for card-form selection.
//
// TWO MECHANICS, CHOSEN BY DATA — NEVER BY A COIN FLIP
// ======================================================
//   "pair"  — preferred whenever the curriculum has a genuine homophone
//             partner for this word (src/data/pitch-pairs.ts): two REAL
//             clips of two DIFFERENT words sharing a reading and differing
//             only in downstep (箸 vs 橋, both はし). The prompt is THIS
//             word's own gloss ("which one means 'chopsticks'?"), so the
//             clip that is graded correct is always the word actually being
//             asked about — never the partner.
//   "wrong" — the fallback for every other word that still carries a
//             verified pitch: the real clip plus a deliberately mis-pitched
//             clip of the SAME word, at the distractor downstep
//             src/lib/pitch.ts's wrongDownstepFor picks. Asks the SAME
//             prompt "pair" mode does ("which one means 'chopsticks'?") —
//             a learner judging pitch by ear still needs to be told what
//             word they're listening for, so the instruction never goes
//             generic just because both clips are nominally the one word.
//             Pitch audio is a pure function of (reading, downstep, voice) —
//             the distractor is fetched through the exact same pitchApiUrl a
//             real word's clip at that downstep would use, never a separate
//             synthesis path or cache namespace.
//
// A word resolves to the SAME mode every time (mode is a property of the
// data, not randomised) — WHETHER a pitch question is offered at all for a
// given showing, versus the fact's ordinary card form, is the caller's coin
// flip (see PITCH_QUESTION_CHANCE), not this module's.
//
// NO GUESSED PITCH, EVER. Both mechanics require this word to already carry
// a verified `wordPitch()` entry — the same "absence is a normal answer"
// rule src/data/pitch.ts documents. A word with none simply never offers a
// pitch question; `rollPitchQuestion` returns null.

import { legacyUnqualifiedGloss, legacyUnqualifiedReading } from "@/data/vocab";
import { wordPitch } from "@/data/pitch";
import { pitchPairsFor } from "@/data/pitch-pairs";
import { moraeOf, wrongDownstepFor } from "@/lib/pitch";
import { pitchApiUrl } from "@/lib/voice";

export type PitchQuizMode = "pair" | "wrong";

/** The decided pitch question for one word — mode plus what it takes to
 * build the audio and the prompt. Pure data. */
export interface PitchQuestion {
  readonly mode: PitchQuizMode;
  /** The word's own taught reading (see legacyUnqualifiedReading) — shared
   * by the partner too, in "pair" mode, by construction. */
  readonly reading: string;
  readonly downstep: number;
  /** This word's own best gloss — the "pair" mode prompt ("which one means
   * X"); unused in "wrong" mode, whose prompt is fixed. */
  readonly gloss: string;
  /** Only set in "pair" mode: the OTHER word's written form and downstep. */
  readonly partnerKeb: string | null;
  readonly partnerDownstep: number | null;
  /** Only set in "wrong" mode: the distractor's own downstep, already
   * resolved by `wrongDownstepFor` (src/lib/pitch.ts) so `buildPitchShowing`
   * never recomputes it and can't disagree with the guard below that decided
   * "wrong" mode was viable at all. Null in "pair" mode. */
  readonly wrongDownstep: number | null;
}

/**
 * Decide `keb`'s pitch question, or null when it has no verified pitch (or
 * no usable gloss/reading — a defensive floor, not an expected path for
 * anything already in the curriculum). `rng` is injectable so a test can pin
 * which partner is chosen when a word has more than one (箸 pairs with both
 * 橋 and 端).
 */
export function rollPitchQuestion(
  keb: string,
  rng: () => number = Math.random,
): PitchQuestion | null {
  const downstep = wordPitch(keb);
  if (downstep == null) return null;
  const reading = legacyUnqualifiedReading(keb);
  // SAK-129: pull the gloss from the SAME sense `legacyUnqualifiedReading`
  // resolved its reading from — never the base VocabRow's own gloss, which
  // for a multi-sense spelling (e.g. 人: ひと/じん/にん) can belong to a
  // different sense entirely and mismatch the reading being quizzed.
  const gloss = legacyUnqualifiedGloss(keb);
  if (!reading || !gloss) return null;

  const pairs = pitchPairsFor(keb);
  if (pairs.length > 0) {
    const chosen = pairs[Math.floor(rng() * pairs.length)] ?? pairs[0];
    // Re-verify rather than trust the ingested table blindly: the partner
    // must still carry a verified, DIFFERENT downstep, and the shared
    // reading must still match what this word is taught with right now.
    const partnerDownstep = wordPitch(chosen.partner);
    if (
      chosen.reading === reading &&
      partnerDownstep != null &&
      partnerDownstep !== downstep
    ) {
      return {
        mode: "pair",
        reading,
        downstep,
        gloss,
        partnerKeb: chosen.partner,
        partnerDownstep,
        wrongDownstep: null,
      };
    }
  }

  // "wrong" mode needs a distractor downstep that actually SOUNDS different
  // (see wrongDownstepFor) — a word too short for one (1 mora) has no honest
  // wrong-pitch question to offer, so it gets none at all rather than a
  // button that silently fails to play.
  const wrongDownstep = wrongDownstepFor(downstep, moraeOf(reading).length);
  if (wrongDownstep == null) return null;

  return {
    mode: "wrong",
    reading,
    downstep,
    gloss,
    partnerKeb: null,
    partnerDownstep: null,
    wrongDownstep,
  };
}

/** One pitch question, frozen onto a showing — plain data, so it rides the
 * drill's serialized runtime exactly like a RecognitionItem does. */
export interface PitchShowing {
  readonly mode: PitchQuizMode;
  /** The word's own gloss — the prompt names it either way ("which one
   * means X?"), pair mode and wrong mode alike (Sam: a learner should never
   * be asked to judge a clip without being told what word it's supposed to
   * be). Only ever null for the defensive case rollPitchQuestion itself
   * already guards against (a missing gloss means no question is offered at
   * all — see its own doc), never a real showing. */
  readonly promptGloss: string | null;
  /** The reading BOTH clips are spoken in (a homophone pair's shared reading,
   * or the one word's own reading in "wrong" mode) — carried so the reveal
   * can draw it with its pitch-accent overline (PitchReading), the same
   * DISPLAY-ONLY convention drill-screen's existing revealPitch already
   * uses, never graded twice. */
  readonly reading: string;
  /** The CORRECT clip's downstep — the pattern the reveal draws. */
  readonly correctDownstep: number;
  /** The two audio clip URLs, already shuffled into the order shown. */
  readonly clips: readonly [string, string];
  /** Index of the correct clip within `clips`. */
  readonly correct: 0 | 1;
}

/**
 * Turn a decided `PitchQuestion` into the two audio URLs and shuffle order a
 * showing freezes — the ONE place that needs the learner's chosen voice
 * (`voiceId`, from cfg.voiceName), which `rollPitchQuestion` deliberately has
 * no business knowing about. `rng` is injectable for tests.
 */
export function buildPitchShowing(
  question: PitchQuestion,
  voiceId: string,
  rng: () => number = Math.random,
): PitchShowing {
  const correctClip = pitchApiUrl(question.reading, question.downstep, voiceId);
  const otherDownstep =
    question.mode === "pair" ? question.partnerDownstep : question.wrongDownstep;
  // Both branches of rollPitchQuestion already guarantee this is set for the
  // mode they return (a "pair" always has a partnerDownstep, a "wrong" always
  // has a wrongDownstep, or the question itself is null) — the correctDownstep
  // fallback below is unreachable in practice, not a real answer.
  const otherClip = pitchApiUrl(question.reading, otherDownstep ?? question.downstep, voiceId);
  const correctFirst = rng() < 0.5;
  return {
    mode: question.mode,
    promptGloss: question.gloss,
    reading: question.reading,
    correctDownstep: question.downstep,
    clips: correctFirst ? [correctClip, otherClip] : [otherClip, correctClip],
    correct: correctFirst ? 0 : 1,
  };
}

/** Did the learner tap the right clip? Graded by INDEX — the two clips can
 * never share a URL (a pair's two words always have different downsteps by
 * construction, and wrongDownstepFor always picks a downstep different from
 * `correct`), so index and URL agree, but index is what the tap actually
 * reports. */
export function gradePitchPick(showing: PitchShowing, chosen: 0 | 1): boolean {
  return chosen === showing.correct;
}

/** The question text a pitch showing asks — the SAME question either
 * mechanic uses ("which one means X?"), naming the word being judged rather
 * than leaving "wrong" mode's clip pair to speak for itself: a learner
 * judging pitch by ear still needs to be told what word they're supposed to
 * be hearing, the same as pair mode already tells them (Sam). The one place
 * this is computed: the live drill and the dev gallery preview both call
 * this instead of each spelling out the same string (see SAK-131 — a
 * hand-copy here is exactly the kind of drift that ticket was about, even
 * without a live symptom yet). */
export function pitchInstruction(showing: Pick<PitchShowing, "promptGloss">): string {
  return `Which one means "${showing.promptGloss}"?`;
}
