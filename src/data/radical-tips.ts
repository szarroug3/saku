// Hand-authored radical recognition tips — SAK-155.
//
// WHY THIS IS ITS OWN FILE, AND NOT radical-enrichment.json
// ===========================================================
// radical-enrichment.json (src/data/generated/) is INGESTED from Kanji Alive
// (scripts/ingest/radical-enrichment.mjs) — a re-ingest overwrites the file
// wholesale, so hand-authored prose has no safe home there. This file is the
// hand-authored counterpart, in the same spirit as src/data/mnemonics.ts and
// src/data/confusable.ts: a small, commented, TypeScript table nobody
// regenerates.
//
// TWO DIFFERENT SHAPES OF CONTENT, TWO DIFFERENT TABLES
// =======================================================
// RADICAL_CONFUSABLE_PAIRS is for two radicals that LOOK alike and need
// contrastive prose to tell apart (口 mouth vs 囗 enclosure) — the same
// "commonly mixed up with" shape ConfusionSection already renders for kanji
// (CONFUSABLE_WITH) and kana (LOOK_GROUP), just with an added tip string.
// The tip is written to read correctly from EITHER glyph's page — it names
// both glyphs itself — so one row of prose serves both directions.
//
// RADICAL_TIPS is for a single radical with a recognisable ROLE (勹 wraps
// around another radical almost every time) that has no specific lookalike
// partner to contrast against. It has nowhere to go in a pair-based mechanism,
// so it renders instead as a plain paragraph in the "As a radical" block.
//
// Keep this short and honest, the same bar src/data/confusable.ts's own header
// sets: would a learner actually be helped by this specific sentence, not
// "is this technically true."

/** Two radicals that look alike, with ONE shared tip written to read correctly
 * from either glyph's own page (it names both glyphs by itself). */
export interface RadicalConfusablePair {
  readonly a: string;
  readonly b: string;
  readonly tip: string;
}

export const RADICAL_CONFUSABLE_PAIRS: readonly RadicalConfusablePair[] = [
  {
    a: "口", // mouth (Kangxi 30) — also the jōyō kanji 口, taught as that kanji card
    b: "囗", // enclosure (Kangxi 31) — radical-only, no jōyō kanji of its own
    tip: "口 (mouth) is a mouth on its own. 囗 (enclosure) is never on its own: it's a wall built around something else, like 国 (country) wrapping 玉 (jewel) inside it, or 回 (turn) wrapping a spiral. If the box has a whole kanji living inside it, it's the enclosure, not the mouth.",
  },
  {
    a: "日", // sun (Kangxi 72) — also the jōyō kanji 日, taught as that kanji card
    b: "曰", // say (Kangxi 73) — radical-only, no jōyō kanji of its own
    tip: "日 (sun) is a tall, narrow box. 曰 (say) is short and squashed flat, like a mouth opened wide to speak. A box that looks stretched short and wide rather than tall is “say,” not “sun.”",
  },
];

/**
 * `glyph`'s pair partner and the shared tip, or undefined when it is not part
 * of a hand-authored pair. Called from EITHER side of a pair — `a` looking up
 * `b`, or `b` looking up `a` — so the relationship reads the same both ways.
 */
export function radicalConfusablePartner(
  glyph: string,
): { readonly glyph: string; readonly tip: string } | undefined {
  for (const pair of RADICAL_CONFUSABLE_PAIRS) {
    if (pair.a === glyph) return { glyph: pair.b, tip: pair.tip };
    if (pair.b === glyph) return { glyph: pair.a, tip: pair.tip };
  }
  return undefined;
}

/**
 * The shared tip for the pair `{x, y}`, order-independent, or undefined when
 * `x` and `y` are not each other's partner. Used to attach a tip to a
 * confusable ROW only when the row's SOURCE page and TARGET glyph are
 * actually this specific pair — a plain lookup by target glyph alone would
 * wrongly attach 日/曰's tip to 目's page just because 日 also appears there
 * (via the unrelated, pre-existing 日/目 kanji lookalike pair).
 */
export function radicalConfusableTip(x: string, y: string): string | undefined {
  for (const pair of RADICAL_CONFUSABLE_PAIRS) {
    if ((pair.a === x && pair.b === y) || (pair.a === y && pair.b === x)) return pair.tip;
  }
  return undefined;
}

/** A single radical's own recognition tip — no lookalike partner, just how to
 * spot its role inside a kanji. */
export interface RadicalTip {
  readonly glyph: string;
  readonly tip: string;
}

export const RADICAL_TIPS: readonly RadicalTip[] = [
  {
    glyph: "勹", // wrap (Kangxi 20)
    tip: "勹 is an open arm curling around something, like a person hugging a bundle. It shows up wrapped around another radical almost every time: 包 (wrap, hugging 己), 勺 (ladle, hugging a drop of liquid), 匂 (scent, hugging 匕). A hook-shaped stroke curling around something else in a kanji is 勹.",
  },
];

/** `glyph`'s own recognition tip, or undefined when it has none authored. */
export function radicalTipFor(glyph: string): string | undefined {
  return RADICAL_TIPS.find((r) => r.glyph === glyph)?.tip;
}
