// What the drill SAYS to the learner, beyond the question itself: what kind of
// answer the box wants, and — once the goes are gone — what they mixed this up
// with.
//
// Pure TypeScript so it can be tested; drill-screen.tsx is a .tsx and the
// runner here cannot load one (same reason drill-stats.ts exists).
//
// NEITHER OF THESE MAY BE A SECOND SOURCE OF TRUTH.
// =================================================
// `answerGuide` is driven by `answerIsJapanese` — the SAME predicate the input
// already uses to decide whether to convert romaji as you type. A hand-kept
// table of "which kinds want romaji" would type-check, read fine, and drift the
// first time a subject changes its answers: the box would convert and the line
// under it would say English, or the reverse. There is one predicate, so there
// is one answer.
//
// `confusionNote` goes through `confusableWith`, which is what the entry page's
// "Commonly mixed up with" line is built from. So the drill claims a confusion
// is KNOWN only where the library already claims it, and the two screens cannot
// disagree about what あ/お is.

import { KANA_SUBJECT } from "@/data/characters";
import { answerIsJapanese } from "@/lib/engine/question";
import { factInfo, glyphOf } from "@/lib/facts";
import { confusableWith, libEntry } from "@/lib/library/entries";
import type { Direction, EntryId, FactId } from "@/types";

/** What a typed card tells you about the answer it wants. */
export interface AnswerGuide {
  /** In the box while it is empty. Short: the field is 270px of large text. */
  readonly placeholder: string;
  /**
   * Under the box, and it STAYS. The placeholder is gone the moment you type a
   * character, which is exactly when "this is turning into kana on purpose"
   * becomes the thing you need to have been told.
   */
  readonly note: string;
}

/**
 * What kind of answer this card wants, for the typed control only.
 *
 * THREE OUTCOMES, AND THE FIRST SPLIT IS `answerIsJapanese`. That predicate
 * answers exactly one question — does the box convert what you type into kana —
 * and it lands where the card kinds do: a kanji reading, a word reading and a
 * grammar production all want romaji and convert; a kanji meaning, a word
 * meaning, a radical meaning and a grammar meaning all want English. Nothing
 * here enumerates those kinds, which is the point.
 *
 * THE THIRD OUTCOME IS KANA ASKED jp2en, and it is why "not Japanese" cannot
 * simply mean "English". Show あ and the answer is "a": latin letters, so
 * `answerIsJapanese` is false and the box does not convert — but it is ROMAJI,
 * not English, and it is the first card a beginner ever sees. That card is
 * exactly the one the probe caught guessing. Telling it to answer in English
 * would be a worse lie than saying nothing.
 *
 * So kana gets its own line, keyed on `info.subject`, which FactInfo carries
 * precisely "so that nobody has to infer a subject by parsing an id". This is
 * one branch on an existing tag, not a parallel table of which kinds want
 * romaji: the convert / do-not-convert decision is still `answerIsJapanese`'s
 * alone, and a new subject that answers in Japanese still gets the right line
 * with no edit here. Kana is the only subject whose answers are romaji, and
 * that is a property of kana rather than a policy this file keeps.
 *
 * (Derived alternatives were tried and are wrong: "does toKana(answer) give
 * back the glyph" says no for every katakana, because toKana produces
 * hiragana, and says YES for おでん and おにぎり, whose English gloss converts
 * straight back to the word. It would mislabel 107 kana and 15 words.)
 *
 * Not called for multiple choice: a board of six has nothing to type, and a
 * line telling you to click one of them is the app narrating itself.
 */
export function answerGuide(fact: FactId, dir: Direction): AnswerGuide {
  if (answerIsJapanese(fact, dir)) {
    return {
      placeholder: "Type romaji, Enter to submit",
      note: "Romaji turns into kana as you type.",
    };
  }
  if (factInfo(fact)?.subject === KANA_SUBJECT) {
    return {
      placeholder: "Type romaji, Enter to submit",
      note: "Romaji is the sound written in English letters.",
    };
  }
  return {
    placeholder: "Type English, Enter to submit",
    note: "Answer in English.",
  };
}

/**
 * The line that names a mix-up at the reveal — or null, which is the common
 * case and renders nothing.
 *
 * `said` is the entry the wrong answer named (`confusedWith`, or the MC option
 * that was clicked). This adds the second question: is that pair one the app
 * already predicts? Only then is there anything to tell them they did not
 * already know. A wrong answer that resolves to some unrelated entry in the
 * deck is a plain miss, and inventing "you mix these up" from one keystroke
 * would put a claim on screen that the mix-ups card would then contradict.
 */
export function confusionNote(asked: EntryId, said: EntryId): string | null {
  if (asked === said) return null;
  const entry = libEntry(asked);
  if (!entry || !confusableWith(entry).includes(said)) return null;
  return `You answered ${glyphOf(said)}. Those two get mixed up a lot.`;
}
