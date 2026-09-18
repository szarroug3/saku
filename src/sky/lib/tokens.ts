// What a kind is called, in the Sky's own words.
//
// This file used to carry a color per kind as well, pointing at the old
// app's sentence-part tokens, with a note saying the components using it drew
// inside the old app's chrome. That app is gone, and nothing had read the map
// for some time before it went (SAK-371). Standings, which do have colors,
// live in src/sky/lib/standing.ts (SAK-294), and the Sky's palette is the
// --sky-* tokens in globals.css (SAK-291).
//
// No hex values in this file, and none anywhere in src/sky.

import type { SkyItem, SkyKind } from "./types";

/** Human label for a kind, for eyebrows and tooltips. */
export const KIND_LABEL: Record<SkyKind, string> = {
  kana: "kana",
  radical: "radical",
  kanji: "kanji",
  word: "word",
  counter: "counter",
  // the specific word, not the broad one (Sam, 2026-09-17): a learner told
  // "grammar" on a 〜は card and shown it in a row headed Sentences cannot
  // tell what they are looking at
  grammar: "grammar pattern",
  sentence: "sentence type",
  term: "term",
  // a writing rule and a grammar concept read as terms (Sam, 2026-09-05)
  mark: "term",
  concept: "term",
  verbPair: "verb pair",
  keigo: "keigo",
};

/**
 * What one thing is called, wherever it is labeled: the Observatory's tile,
 * the eyebrow on the lesson card and the Atlas entry, and the tooltip over a
 * star. One function, so the same thing is never two names (Sam, 2026-09-17:
 * "if this is grammar, why is it in the sentences area and then labeled as a
 * particle? is it a particle or grammar?").
 *
 * The item's own word wins where it has one, because only the app's tables
 * know that は is a particle and 〜ている is not. A kana says which script it
 * is, since "kana" is the one kind whose two halves a learner picks between.
 * Everything else is the kind's own word.
 */
export function typeLabel(item: SkyItem): string {
  if (item.label) return item.label;
  if (item.kind === "kana") return /[゠-ヿ]/.test(item.glyph) ? "katakana" : "hiragana";
  return KIND_LABEL[item.kind];
}
