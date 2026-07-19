// The shapes kanji are built out of — and the honest limit on what we know
// about them.
//
// KRADFILE decomposes all 2,136 jōyō kanji into 237 DISTINCT components. They
// split cleanly in two, and the split is the whole reason this file exists:
//
//   155 ARE THEMSELVES JŌYŌ KANJI — 木, 日, 口. They have meanings, readings,
//       facts and a Library entry page already. Nothing here is about them;
//       kanjiRow() answers everything.
//
//    82 ARE PRIMITIVES — ノ, ｜, 丶, 匕, 勹. There is no KANJIDIC2 row for any
//       of them, which means NO MEANING, NO NAME AND NO READING exists anywhere
//       in the data. The one thing measured about them is a stroke count, and
//       that is what `primitiveStrokes` holds. It is a complete map: every one
//       of the 82 has an entry and there are no spares (see components.test.ts,
//       which pins both directions).
//
// NOTHING MAY INVENT THE MISSING HALF. Several of the 82 are not radicals in
// any teaching sense at all: ｜ is a vertical stroke and ノ a diagonal one,
// artefacts of how KRADFILE cuts a glyph up. src/components/lesson/
// how-its-written.tsx already calls raw comps "unreliable for teaching" and
// keeps them off the lesson. A radical page may therefore SHOW one and say what
// it does not know, and that is the most it may ever say.

import componentsJson from "./generated/components.json" with { type: "json" };

/**
 * Stroke count for each of the 82 components that are not kanji.
 *
 * The complete inventory of primitives as well as their measurement: membership
 * here is the definition of "primitive", because it is the only list of them
 * that exists.
 */
export const PRIMITIVE_STROKES: ReadonlyMap<string, number> = new Map(
  Object.entries((componentsJson as { primitiveStrokes: Record<string, number> })
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
