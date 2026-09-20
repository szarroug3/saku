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

import { conjugate } from "../lib/conjugate/index.ts";

/** Two words that gloss the same in English, with ONE shared note written to
 * read correctly from either word's own page (it names both words itself). */
export interface WordContrastPair {
  readonly a: string;
  readonly b: string;
  readonly note: string;
}

// ---------------------------------------------------------------------------
// THE ずる / じる PAIRS (SAK-423).
//
// 演じる and 演ずる are not two words. They are one verb spelled two ways, and
// JMdict carries them as two entries, so the app carries them as two vocabulary
// rows with two sets of facts. A learner meets both and nothing said they were
// the same verb.
//
// WHICH ONE THE APP TEACHES. The じる spelling, and Sam decided it on
// 2026-09-12: modern usage has gone to じ across the paradigm, and the engine
// now builds the じ forms for the ずる entry too (see VZ_FORMS in
// lib/conjugate/rules.ts). So 演ずる's own Forms table reads 演じます, 演じられる,
// 演じれば, correct, and baffling without a line saying why the headword up the
// page is spelled with ず. This is that line.
//
// THE HEADWORD IS NOT REWRITTEN, and that is the one place this lands short of
// "the dictionary form shown becomes the じる spelling". Both spellings are
// already vocabulary rows here, with their own entry ids, their own weights in
// the library index and their own progress. Rewriting 演ずる's keb to 演じる
// would not rename an entry, it would mint a duplicate of one that exists.
// So the ずる entry keeps the spelling JMdict gives it, and the note is what
// carries the fact that it is the older one.
// ---------------------------------------------------------------------------

/** The ten ずる entries, by their dictionary spelling. Their じる twins are the
 * same string with the ず swapped for じ, which is why only one column is
 * written out, and `zuruPair` asserts the twin is really that, rather than
 * trusting the swap. */
const ZURU_VERBS: readonly string[] = [
  "演ずる",
  "禁ずる",
  "重んずる",
  "乗ずる",
  "信ずる",
  "生ずる",
  "命ずる",
  "論ずる",
  "応ずる",
  "感ずる",
];

/**
 * One ずる/じる pair and its shared note, with the three sample forms read off
 * the engine rather than typed out.
 *
 * Reading them is the point: the note's whole claim is that the forms are the
 * じ ones, and a note that spelled them by hand could go on claiming it after
 * someone changed the table. If the engine ever refuses one, the note drops the
 * examples rather than printing a half-built list.
 */
function zuruPair(zuru: string): WordContrastPair {
  const jiru = zuru.replace("ずる", "じる");
  const forms = (["masu", "passive", "ba"] as const)
    .map((f) => conjugate(zuru, "vz", f))
    .filter((r) => r.ok)
    .map((r) => (r.ok ? r.value : ""));
  const examples = forms.length === 3 ? ` The forms are the じ ones either way: ${forms.join(", ")}.` : "";
  return {
    a: jiru,
    b: zuru,
    note:
      `${jiru} and ${zuru} are the same verb, written two ways. ${jiru} is the modern ` +
      `spelling and the one to use; ${zuru} is the older one, and you might still see it ` +
      `in print.${examples}`,
  };
}

export const WORD_CONTRAST_PAIRS: readonly WordContrastPair[] = [
  ...ZURU_VERBS.map(zuruPair),
  {
    a: "いいえ",
    b: "いや",
    // SAK-229: いや's own example sentence ("たとえいやでもその仕事はしなけ
    // ればいけないよ。" — "you must do the work, even if you don't like it")
    // already demonstrates the reluctance sense; this note is what makes that
    // connection explicit rather than leaving it for the learner to infer.
    note:
      "いいえ and いや both mean “no,” but they aren't interchangeable. いいえ is the neutral, all-purpose no. It's plain and safe in any setting, including polite conversation, and it's also how you wave off a compliment (“not at all”). いや is casual and has feeling in it. It usually means “I don't want to” or “I'd rather not,” which makes it a personal refusal, so it can sound blunt or childish somewhere formal.",
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
