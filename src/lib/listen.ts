// LISTENING — the audio-prompt question types, as a decision over a fact.
//
// Task 22 ruled: listening is IN, as new quiz types, WORDS ONLY, and always
// OPT-IN — never a requirement, never a gate. Two of them:
//
//   hear → romaji   audio only → the word's romaji reading (forgiving romaji path)
//   hear → meaning  audio only → the word's English gloss   (the meaning check)
//
// Both reuse EXISTING word facts and their EXISTING grading. Listening is not a
// new engine QuestionType — the fact, the answer and the check are unchanged.
// It is a PRESENTATION: the prompt plays the word instead of showing its glyph,
// which is the jp2en question with the glyph taken away. So this module answers
// only two questions, and both are pure and testable:
//
//   listenKind(fact)          — is this a word reading fact, a word meaning
//                               fact, or neither (so, listenable how)?
//   pickListen(fact, cfg, rng)— should THIS showing be audio, given the
//                               learner's opt-in flags?
//
// The owner ruled sentences OUT (romaji transcription of a sentence is
// ambiguous — は as wa, long vowels, spacing — and would break "never mark
// correct Japanese wrong"; and there is no sentence audio). Nothing here has a
// sentence branch; the vocabulary facts are the whole surface.

import { VOCAB_SUBJECT, wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { factInfo } from "@/lib/facts";
import type { FactId, QuizConfig } from "@/types";

/** Which listening type a fact can be asked as — or null when it cannot.
 *  "romaji"  → a word READING fact (hear it, type the romaji).
 *  "meaning" → a word MEANING fact (hear it, give the gloss). */
export type ListenKind = "romaji" | "meaning";

/**
 * The listening type this fact supports, or null. Word-only by construction: a
 * kana, a kanji reading or a grammar pattern returns null and can never become
 * a listening card. A kana WORD (これ) has no separate reading fact, so it is
 * "meaning"-only — which is exactly right, since hearing これ and typing "kore"
 * would be typing the prompt back.
 */
export function listenKind(fact: FactId): ListenKind | null {
  const info = factInfo(fact);
  if (!info || info.subject !== VOCAB_SUBJECT) return null;
  if (wordReadingFactId(info.glyph) === fact) return "romaji";
  if (wordMeaningFactId(info.glyph) === fact) return "meaning";
  return null;
}

/** Whether the learner has turned ON the listening type this fact supports.
 *  Both flags default false, so this is false for every fact until the learner
 *  opts in — the whole "never forced" guarantee rests here. */
export function listenEnabledFor(fact: FactId, cfg: QuizConfig): boolean {
  const kind = listenKind(fact);
  if (kind === "romaji") return cfg.listenRomaji;
  if (kind === "meaning") return cfg.listenMeaning;
  return false;
}

/**
 * How often an ELIGIBLE word showing is presented as audio rather than as the
 * ordinary visual card. Not 1: turning listening on ADDS a way to be asked, it
 * does not replace reading the glyph, so half of a listenable word's showings
 * stay visual and half become audio. Mirrors `pickDir`, which chooses uniformly
 * among the enabled directions. A named constant, and a knob the owner may want
 * to move — flagged in the report rather than buried.
 */
export const LISTEN_SHARE = 0.5;

/**
 * Whether THIS showing of `fact` should be an audio (listening) card.
 *
 * False unless the learner opted in AND the fact is a listenable word AND the
 * coin lands — so it is never forced and, being additive to the deck, never
 * gates progression. `rng` is injectable so a test can pin the coin. The caller
 * (the drill) forces the jp2en answer path when this is true, because the audio
 * question IS the jp2en question with the glyph hidden.
 */
export function pickListen(
  fact: FactId,
  cfg: QuizConfig,
  rng: () => number = Math.random,
): boolean {
  if (!listenEnabledFor(fact, cfg)) return false;
  return rng() < LISTEN_SHARE;
}
