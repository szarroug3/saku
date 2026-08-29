// Hand-authored word-nuance contrast notes — SAK-229.
//
// WHY THIS IS ITS OWN FILE, AND NOT src/data/vocab.ts
// =====================================================
// vocab.ts (and every src/data/generated/*.json it reads) is INGESTED from
// JMdict — a re-ingest overwrites it wholesale, so hand-authored prose has no
// safe home there. This file is the hand-authored counterpart, in the same
// spirit as src/data/radical-tips.ts, src/data/mnemonics.ts, and
// src/data/confusable.ts: a small, commented, TypeScript table nobody
// regenerates.
//
// WHAT THIS IS FOR, AND WHAT IT IS NOT
// =====================================================
// This is NOT a shape-confusable distractor source (that's confusable.ts) and
// it does not feed ConfusionSection's "commonly mixed up with" mechanism
// (that predicts a WRONG QUIZ ANSWER from visual or reading similarity —
// see confusable.ts's own header on why "thematically related" is explicitly
// the wrong bar for that job). Two words that both gloss to the same English
// word are never distractor candidates by that mechanism, and this file does
// not touch it.
//
// This is prose for the opposite problem: two words a learner can answer
// correctly on a quiz forever without ever learning why there are two of them
// (SAK-229 — いいえ and いや both teach the single gloss "no", and nothing on
// either word's page said why one isn't just a spare copy of the other). One
// shared note per pair, written to read correctly from EITHER word's own
// Library page or lesson card — the same "resolves from either side" shape
// RADICAL_CONFUSABLE_PAIRS already uses for shape pairs.
//
// Keep this short and honest, the bar radical-tips.ts and confusable.ts both
// set: would a learner actually be helped by this specific sentence, not "is
// this technically true."

/** Two words that gloss the same in English, with ONE shared note written to
 * read correctly from either word's own page (it names both words itself). */
export interface WordContrastPair {
  readonly a: string;
  readonly b: string;
  readonly note: string;
}

export const WORD_CONTRAST_PAIRS: readonly WordContrastPair[] = [
  {
    a: "いいえ",
    b: "いや",
    // SAK-229: いや's own example sentence ("たとえいやでもその仕事はしなけ
    // ればいけないよ。" — "you must do the work, even if you don't like it")
    // already demonstrates the reluctance sense; this note is what makes that
    // connection explicit rather than leaving it for the learner to infer.
    note:
      "いいえ and いや both gloss as “no,” but they aren't interchangeable. いいえ is the neutral, all-purpose no: plain and safe in any setting, including polite conversation, and it's also how you wave off a compliment (“not at all”). いや is casual and carries feeling: it usually means “I don't want to” or “I'd rather not,” a personal refusal more than a flat fact, so it can land as blunt or childish somewhere formal.",
  },
];

/**
 * `glyph`'s pair partner and the shared note, or undefined when it is not
 * part of a hand-authored pair. Called from EITHER side of a pair — `a`
 * looking up `b`, or `b` looking up `a` — so the relationship reads the same
 * both ways.
 */
export function wordContrastPartner(
  glyph: string,
): { readonly glyph: string; readonly note: string } | undefined {
  for (const pair of WORD_CONTRAST_PAIRS) {
    if (pair.a === glyph) return { glyph: pair.b, note: pair.note };
    if (pair.b === glyph) return { glyph: pair.a, note: pair.note };
  }
  return undefined;
}

/** `glyph`'s own contrast note (naming its partner), or undefined when it has
 * none authored. */
export function wordContrastNoteFor(glyph: string): string | undefined {
  return wordContrastPartner(glyph)?.note;
}
