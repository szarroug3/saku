// The FORMULA a kanji-reading card is hinted with — task #22.
//
// A reading card asks how ONE kanji is said inside a word the learner knows:
// "病 in 病院 → ?". The honest nudge is the rest of the word with ITS readings
// filled in and the asked piece left blank —
//
//     [病] + [院 / いん]  =  病院
//
// The asked piece carries no reading (that is the answer, and a hint never holds
// the answer — see engine/hint.ts). Every OTHER piece carries the reading it
// takes IN THIS WORD, read off the word's own per-kanji alignment, so the learner
// can back the answer out of the whole: びょう + いん is びょういん, so 病 must be
// びょう. A kana tail (病む's む) is already phonetic and shows as itself.
//
// PURE AND DATA-DRIVEN. This builds the STRUCTURE only — pieces and result — from
// data the app already holds (the word's `align`). The drill screen renders it;
// this module decides nothing about how it looks. Kept out of engine/hint.ts and
// in src/lib so the tests glob (src/**/*.test.ts) can pin the construction
// without a component.

import { kanjiRow } from "@/data/kanji";
import { vocabRow } from "@/data/vocab";

/** One term of the formula: a run of the word. `reading` is the sound it takes
 * in this word — present on every piece EXCEPT the one being asked, which is
 * left blank because its reading is the answer. Kana pieces have no `reading`;
 * they already are their sound. */
export interface FormulaPiece {
  readonly text: string;
  readonly reading?: string;
}

/** The whole nudge: the pieces to lay out left to right, and the word they
 * assemble into on the right of the `=`. */
export interface ReadingFormula {
  readonly pieces: readonly FormulaPiece[];
  readonly result: string;
}

/**
 * Build the reading formula for asking `kanji`'s reading inside `word`, or null
 * when there is nothing honest to lay out — an unknown word, a single-piece word
 * (nothing beside the kanji to show), or a word whose asked kanji it does not
 * contain.
 *
 * Walks the word left to right: each kanji becomes its own piece (its reading
 * pulled from the word's alignment, in order, so a repeated kanji still reads off
 * the right slot), and each maximal run of kana becomes one piece with no
 * reading. The asked kanji's piece is blanked. `align` is the app's own
 * per-kanji breakdown; a word without one (a jukujikun like 大人) attests no
 * kanji reading and so is never a reading anchor, but is guarded here anyway.
 */
export function readingFormula(
  kanji: string,
  word: string,
): ReadingFormula | null {
  const chars = [...word];
  if (chars.length < 2) return null;
  if (!chars.includes(kanji)) return null;

  const align = vocabRow(word)?.align ?? null;
  // A queue of the per-kanji surface readings, consumed in the order the kanji
  // appear so the same character in two slots (時々) still lines up.
  const surfaces = (align ?? []).map(([, surface]) => surface);
  let surfaceIdx = 0;

  const pieces: FormulaPiece[] = [];
  let kanaRun = "";
  const flushKana = (): void => {
    if (kanaRun) {
      pieces.push({ text: kanaRun });
      kanaRun = "";
    }
  };

  let asked = false;
  for (const c of chars) {
    if (kanjiRow(c)) {
      flushKana();
      const surface = surfaces[surfaceIdx++];
      // Blank the asked kanji ONCE — its reading is the answer. A later same
      // kanji (if any) keeps its reading, so the whole still assembles.
      if (c === kanji && !asked) {
        asked = true;
        pieces.push({ text: c });
      } else {
        pieces.push(surface ? { text: c, reading: surface } : { text: c });
      }
    } else {
      kanaRun += c;
    }
  }
  flushKana();

  // Two or more pieces, or there is nothing beside the asked kanji to show — the
  // single-piece case the caller was supposed to have excluded already.
  if (pieces.length < 2) return null;
  return { pieces, result: word };
}
