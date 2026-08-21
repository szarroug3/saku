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
//             clip of the SAME word (src/lib/tts-synth.ts's
//             synthesizeWrongPitchWordWav). "Which one sounds right?"
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

import { legacyUnqualifiedReading, vocabRow } from "@/data/vocab";
import { wordPitch } from "@/data/pitch";
import { pitchPairsFor } from "@/data/pitch-pairs";
import { pitchApiUrl, pitchWrongApiUrl } from "@/lib/voice";

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
  const row = vocabRow(keb);
  const gloss = row?.glosses[0];
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
      };
    }
  }

  return {
    mode: "wrong",
    reading,
    downstep,
    gloss,
    partnerKeb: null,
    partnerDownstep: null,
  };
}

/** How often a showing that IS otherwise eligible (see drill-screen.tsx's
 * gate: japanese-source jp2en MEANING card, Audio prompts on, a word with
 * verified pitch) rolls a pitch question instead of its ordinary card form.
 * Not 100%: a word with a pitch question keeps getting asked its everyday
 * meaning/reading most of the time too, exactly the way particleMarker's own
 * 50/50 coin flip keeps its base tap-drill form in circulation (see
 * lib/engine/particle-drill.ts) rather than replacing it outright. */
export const PITCH_QUESTION_CHANCE = 0.35;

/** One pitch question, frozen onto a showing — plain data, so it rides the
 * drill's serialized runtime exactly like a RecognitionItem does. */
export interface PitchShowing {
  readonly mode: PitchQuizMode;
  /** "pair" mode's prompt text (a gloss); null for "wrong" mode, whose
   * instruction is fixed ("Which one sounds right?"). */
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
  const otherClip =
    question.mode === "pair" && question.partnerDownstep != null
      ? pitchApiUrl(question.reading, question.partnerDownstep, voiceId)
      : pitchWrongApiUrl(question.reading, question.downstep, voiceId);
  const correctFirst = rng() < 0.5;
  return {
    mode: question.mode,
    promptGloss: question.mode === "pair" ? question.gloss : null,
    reading: question.reading,
    correctDownstep: question.downstep,
    clips: correctFirst ? [correctClip, otherClip] : [otherClip, correctClip],
    correct: correctFirst ? 0 : 1,
  };
}

/** Did the learner tap the right clip? Graded by INDEX — the two clips can
 * never share a URL (a pair's two words have different downsteps, and a
 * synthetic wrong clip lives in its own cache namespace — see
 * src/lib/voice.ts's pitchWrongObjectPath), so index and URL agree, but index
 * is what the tap actually reports. */
export function gradePitchPick(showing: PitchShowing, chosen: 0 | 1): boolean {
  return chosen === showing.correct;
}
