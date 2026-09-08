// What a kind is called, in the Sky's own words.
//
// This file used to carry a colour per kind as well, pointing at the old
// app's sentence-part tokens, with a note saying the components using it drew
// inside the old app's chrome. That app is gone, and nothing had read the map
// for some time before it went (SAK-371). Standings, which do have colours,
// live in src/sky/lib/standing.ts (SAK-294), and the Sky's palette is the
// --sky-* tokens in globals.css (SAK-291).
//
// No hex values in this file, and none anywhere in src/sky.

import type { SkyKind } from "./types";

/** Human label for a kind, for eyebrows and tooltips. */
export const KIND_LABEL: Record<SkyKind, string> = {
  kana: "kana",
  radical: "radical",
  kanji: "kanji",
  word: "word",
  counter: "counter",
  grammar: "grammar",
  sentence: "sentences",
  term: "term",
  // a writing rule and a grammar concept read as terms (Sam, 2026-09-05)
  mark: "term",
  concept: "term",
  verbPair: "verb pair",
  keigo: "keigo",
};
