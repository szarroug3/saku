// The shapes kanji are built out of — and the honest limit on what we know
// about them.
//
// KanjiVG's depth-1 decomposition (scripts/ingest/kanjivg.mjs) uses 844 DISTINCT
// components across the 2,136 jōyō kanji. They split cleanly in two, and the
// split is the whole reason this file exists:
//
//   482 ARE THEMSELVES JŌYŌ KANJI — 木, 日, 口. They have meanings, readings,
//       facts and a Library entry page already. Nothing here is about them;
//       kanjiRow() answers everything.
//
//   362 ARE PRIMITIVES — 匕, 勹, 亻, 氵, 艹. There is no KANJIDIC2 row for any
//       of them, which means NO MEANING, NO NAME AND NO READING exists anywhere
//       in the data. The one thing measured about them is a stroke count, and
//       that is what `primitiveStrokes` holds. It is a complete map: every one
//       of the 362 has an entry and there are no spares (see components.test.ts,
//       which pins both directions).
//
// NOTHING MAY INVENT THE MISSING HALF. Many primitives are bound or variant
// forms with no standalone character — 亻 (person), 氵 (water), 艹 (grass). A
// radical page may therefore SHOW one and say what it does not know, and that is
// the most it may ever say. Where a variant IS a form of a taught character (亻
// of 人), the "Made of" row links through to it — see `variantTaughtKanji` in
// data/kanji.ts — but the standalone shape still has no facts of its own.
//
// Unlike KRADFILE, KanjiVG does not cut single strokes out as components, so the
// old stroke-artefacts (｜ a bare vertical, ノ a diagonal) are simply absent.

import kanjiComponentsJson from "./generated/kanji-components.json" with { type: "json" };

/**
 * Stroke count for each component that is not itself a jōyō kanji.
 *
 * The complete inventory of primitives as well as their measurement: membership
 * here is the definition of "primitive", because it is the only list of them
 * that exists. Sourced (with the decomposition itself) from KanjiVG via
 * scripts/ingest/kanjivg.mjs — the stroke count is the number of strokes drawn
 * beneath the component's group in the SVG.
 */
export const PRIMITIVE_STROKES: ReadonlyMap<string, number> = new Map(
  Object.entries((kanjiComponentsJson as { primitiveStrokes: Record<string, number> })
    .primitiveStrokes),
);

/** True for a component with no kanji entry — ノ, ｜, 丶. */
export function isPrimitive(c: string): boolean {
  return PRIMITIVE_STROKES.has(c);
}

/** How many strokes a primitive takes, or undefined for a stranger. */
export function primitiveStrokes(c: string): number | undefined {
  return PRIMITIVE_STROKES.get(c);
}
