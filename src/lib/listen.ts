// LISTENING — which facts can be asked with an AUDIO prompt.
//
// Task 22 ruled: listening is IN, WORDS ONLY. Two kinds:
//
//   hear → romaji   audio only → the word's romaji reading (forgiving romaji path)
//   hear → meaning  audio only → the word's English gloss   (the meaning check)
//
// Both reuse EXISTING word facts and their EXISTING grading. Listening is not a
// new engine QuestionType — the fact, the answer and the check are unchanged.
// It is a PRESENTATION: the prompt plays the word instead of showing its glyph,
// which is the jp2en question with the glyph taken away.
//
// Task 30 folded audio into "How to ask" as `Prompt Format: Audio` (see
// src/lib/ask-forms.ts) and retired the two opt-in flags and the per-showing
// coin — an enabled audio form is now ASKED, not sampled. So this module is down
// to the one question that is still a property of the FACT:
//
//   listenKind(fact) — is this a word reading fact, a word meaning fact, or
//                      neither (so, listenable how)?
//
// The owner ruled sentences OUT (romaji transcription of a sentence is
// ambiguous — は as wa, long vowels, spacing — and would break "never mark
// correct Japanese wrong"; and there is no sentence audio). Nothing here has a
// sentence branch. Kana dictation is a separate, explicitly generated form in
// ask-forms.ts: hear /a/ → produce あ. It does not use listenKind because its
// target is the glyph rather than the fact's ordinary jp→en answer.

import { VOCAB_SUBJECT, wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

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
