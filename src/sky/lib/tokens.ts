// Kind colour for the ItemCard era, mapped onto the app's existing semantic
// tokens.
//
// The Sky's own palette is the night theme: the --sky-* tokens in globals.css
// (SAK-291), reached as bg-sky-*, text-sky-* and font-sky-* classes. The kind
// map below predates it and still points at the current app's tokens, because
// the components that use it (ItemCard, ItemSection) render inside current-app
// chrome for now. Status colour is no longer here: standings, with their own
// tokens, legend and chip, live in src/sky/lib/standing.ts (SAK-294).
//
// Either way: no hex values in this file, and none anywhere in src/sky.

import type { SkyKind } from "./types";

/**
 * The accent for each content kind, as a Tailwind class on an existing token.
 *
 * Saku's palette is deliberately small — one accent, plus the three sentence-part
 * hues and the semantic danger/success/warning. There is no six-colour categorical
 * ramp to borrow, and inventing one would break every theme. So kinds reuse the
 * sentence-part colours (which already exist per theme and are already used to
 * distinguish parts of speech) and the accent.
 *
 * If this proves too few distinctions once several kinds sit side by side, the fix
 * is to add tokens to globals.css for every theme, NOT to hardcode here.
 */
export const KIND_DOT: Record<SkyKind, string> = {
  kana: "bg-sentence-core",
  radical: "bg-sentence-ending",
  kanji: "bg-accent",
  word: "bg-sentence-topic",
  counter: "bg-warning",
  grammar: "bg-success",
  sentence: "bg-success",
  term: "bg-success",
  // Verb pairs and keigo are word families, so they share the word hue rather
  // than inventing two more. Saku's palette has no categorical ramp to draw an
  // eighth distinct colour from, and these three never appear in the same
  // section, so the collision is never seen side by side.
  verbPair: "bg-sentence-topic",
  keigo: "bg-sentence-topic",
};

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
  verbPair: "verb pair",
  keigo: "keigo",
};
