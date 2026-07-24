// WHAT THE QUESTION IS ASKING YOU FOR, said in words, on every card.
//
// THE BUG
// =======
// A drill card showed a prompt and an input and nothing else. Shown "one" with
// a text box, the owner typed いち — the reading — because nothing on screen
// said the card wanted the KANJI 一. It was marked wrong, twice, and the reveal
// then printed an answer she had no way to enter: romaji types kana, and there
// is no romaji for 一.
//
// Two separate faults met there. The unanswerable box is fixed where it was
// caused (the board must build; see buildMcOptions and DrillScreen). This module
// fixes the other half, and the more general one: the card never said what it
// wanted. That was true of EVERY card, not just this one — the drill had a
// `context` field carrying one-word fragments ("meaning", "in japanese") on
// three of the six subjects and nothing at all on the rest.
//
// THE AXES
// ========
// An instruction is a function of four things, and none of them is the subject's
// private business:
//
//   dir      en2jp — you are shown a meaning and must produce Japanese
//            jp2en — you are shown Japanese and must produce what it says
//   mode     mc    — pick one of these
//            typed — write it
//   japanese whether the ANSWER is Japanese, which is not the same as `dir`:
//            a kanji asked jp2en wants English ("life"), but a kanji READING
//            asked jp2en wants kana (せい). `answerIsJapanese` already owns
//            this question for the romaji converter, so it owns it here too and
//            the two cannot drift.
//   noun     what to call the thing being asked for — "kanji", "word", "kana".
//
// WHY IT IS NOT A STRING ON THE QUESTION TYPE
// ===========================================
// Because that is what `context` was, and it is why four subjects had none: an
// optional field each subject fills in for itself gets filled in by whoever was
// thinking about it that day. Deriving the sentence from the axes means a new
// subject gets a correct instruction by existing, and a wrong one is a wrong
// NOUN rather than a missing line.

import { VOCAB_SUBJECT, wordReadingFactId } from "@/data/vocab";
import { answerIsJapanese } from "@/lib/engine/question";
import { factInfo } from "@/lib/facts";
import type { Direction, FactId } from "@/types";

/** How the instruction names the thing you are being asked to produce.
 *
 * "Shape" for a radical rather than "radical": the drill is the wrong place to
 * be quizzing vocabulary about the curriculum, and a learner who has met 亅
 * knows it as a shape that turns up inside kanji. See role-block.tsx, which
 * uses the same plain word for the same reason. */
const NOUN: Record<string, string> = {
  kana: "kana",
  kanji: "kanji",
  radical: "shape",
  word: "word",
  grammar: "pattern",
  keigo: "keigo verb",
  transitivity: "verb",
};

function nounFor(fact: FactId): string {
  return NOUN[factInfo(fact)?.subject ?? ""] ?? "answer";
}

/**
 * The instruction line for a card, or null when there is nothing useful to say.
 *
 * Never returns null today. It is nullable because the drill renders this in a
 * slot that must be allowed to be empty — a future card type that is genuinely
 * self-explanatory should be able to say so, rather than being forced to invent
 * a sentence.
 */
export function quizInstruction(
  fact: FactId,
  dir: Direction,
  mode: "mc" | "typed",
): string | null {
  if (!factInfo(fact)) return null;
  const noun = nounFor(fact);
  // "Not Japanese" is not the same as "a meaning". Kana asked jp2en wants "a" —
  // latin, so not Japanese, and yet not a meaning either: あ does not MEAN
  // anything, and "type what it means" over a kana card is nonsense. FactInfo
  // already records this (`meaning: null`), so the data answers it and no
  // subject list is needed.
  const wantsMeaning =
    !answerIsJapanese(fact, dir) && factInfo(fact)?.meaning != null;

  if (mode === "mc") {
    // The owner's own phrasing: "which of the following is the correct
    // [kanji, word, whatever]?". Shortened to "these" because the options sit
    // directly beneath it and "the following" is doing no work.
    if (wantsMeaning) return "Which of these is what it means?";
    // A Japanese answer that is all kana is a SOUND, not a spelling — asking
    // "which of these is the correct word" over a board of readings is asking
    // the wrong question about the right options.
    if (isSound(fact, dir)) return "Which of these is how it's said?";
    return `Which of these is the correct ${noun}?`;
  }

  if (wantsMeaning) return "Type what it means.";
  if (isSound(fact, dir)) return "Type how it's said.";
  // Reached only if a typed card ever wants a written form containing kanji,
  // which the drill is supposed to make impossible (it offers those as a board).
  // Kept honest rather than unreachable-by-assumption: if the guard upstream
  // ever fails again, the card at least says what it wants.
  return `Type the ${noun}.`;
}

/** Whether the Japanese answer is a READING rather than a written form.
 *
 * NOT "is the answer all kana". That was the first version of this and it got
 * kana itself backwards: shown "a" and asked for あ, you are producing the
 * CHARACTER, and "how it's said" is the wrong sentence over a board of kana even
 * though every option on it is kana. The same trap catches a kana-only word —
 * これ is a spelling, not a sound.
 *
 * The honest question is which of the fact's two en2jp shapes this is, and only
 * one subject has both: a WORD can be asked by its meaning (produce 問題) or by
 * its reading (produce もんだい). Everyone else produces their glyph.
 *
 * jp2en only reaches here when the answer is already Japanese, and a Japanese
 * jp2en answer is a reading by construction — that is the whole of what the
 * Japanese side of jp2en contains. */
function isSound(fact: FactId, dir: Direction): boolean {
  if (dir === "jp2en") return true;
  const info = factInfo(fact);
  if (!info || info.subject !== VOCAB_SUBJECT) return false;
  return wordReadingFactId(info.glyph) === fact;
}
