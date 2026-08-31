// Grove colour, mapped ONTO the app's existing semantic tokens.
//
// The redesign concept artifacts each invented their own palette (indigo grounds,
// pink blossoms, violet accents). Those were for exploring layout only. Production
// keeps Saku's scheme, because that scheme is what carries four themes (aizome,
// graphite, momentum, kiri), the accent variants, and light/dark — all from one
// set of CSS custom properties.
//
// So there are no hex values in this file, and there should be none anywhere in
// src/grove. Everything below resolves to a `var(--…)` token that already changes
// with the active theme. Tracked as SAK-291.

import type { GroveKind, GroveStatus } from "./types";

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
export const KIND_DOT: Record<GroveKind, string> = {
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
export const KIND_LABEL: Record<GroveKind, string> = {
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
  GroveStatus,
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
export const STATUS_ORDER: GroveStatus[] = ["mastered", "learned", "planted", "wild"];
