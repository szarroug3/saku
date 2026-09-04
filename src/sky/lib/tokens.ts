// Kind and status colour for the ItemCard era, mapped onto the app's existing
// semantic tokens.
//
// The Sky's own palette is the night theme: the --sky-* tokens in globals.css
// (SAK-291), reached as bg-sky-*, text-sky-* and font-sky-* classes. The two
// maps below predate it and still point at the current app's tokens, because
// the components that use them (ItemCard, ItemSection) render inside current-app
// chrome for now. SAK-294 replaces the four-value status with the app's
// standings and moves these onto the night palette.
//
// Either way: no hex values in this file, and none anywhere in src/sky.

import type { SkyKind, SkyStatus } from "./types";

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
  verbPair: "verb pair",
  keigo: "keigo",
};

/**
 * How each status reads. `dot` is the status marker; `glyph` tints the character
 * itself so a grid scans by knowledge at a glance; `label` is the wording used in
 * every legend, so the four surfaces stay consistent.
 */
export const STATUS: Record<
  SkyStatus,
  { dot: string; glyph: string; label: string }
> = {
  mastered: {
    dot: "bg-success",
    glyph: "text-success",
    label: "mastered",
  },
  learned: {
    dot: "bg-accent",
    glyph: "text-text",
    label: "learned",
  },
  planted: {
    dot: "bg-text-muted",
    glyph: "text-text-muted",
    label: "on your tree, unopened",
  },
  wild: {
    dot: "bg-border",
    glyph: "text-text-muted/60",
    label: "not planted",
  },
};

/** The four statuses in the order every legend and filter rail shows them. */
export const STATUS_ORDER: SkyStatus[] = ["mastered", "learned", "planted", "wild"];
