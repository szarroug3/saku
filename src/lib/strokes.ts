"use client";

// Stroke-order data: lazy access to the KanjiVG-derived asset.
//
// WHY IT LOADS THE WAY IT DOES
// ============================
// The stroke data (src/data/generated/strokes/hiragana.json) is only ever
// needed once the learner OPENS "how it's written" on a glyph that has it. So
// it is not imported at module load — it would ride into the client bundle for
// every screen that never expands the section. Instead `loadStrokes()` does a
// dynamic import the first time it's asked, which webpack code-splits into its
// own chunk fetched on demand, and caches the promise so a second glyph doesn't
// refetch. The section stays lean until it's actually used.
//
// EXTENDING TO KATAKANA / KANJI
// =============================
// Today only hiragana is ingested (scripts/ingest/kanjivg.mjs). A glyph with no
// entry returns null and the caller falls back to "whole shape" — no crash. When
// katakana/kanji land, add their JSON and widen `loadStrokes` to consult them;
// the renderer and the null-fallback contract don't change.

import { useEffect, useState } from "react";

/** One glyph's stroke order, on KanjiVG's native 109×109 grid. */
export interface GlyphStrokes {
  /** SVG path `d` strings, in drawing order. */
  readonly strokes: string[];
  /** Stroke-number label positions, `[x, y]`, aligned to `strokes` by index. */
  readonly numbers: [number, number][];
}

/** The KanjiVG grid every stroke path is expressed on. */
export const STROKE_GRID = 109;

type StrokeMap = Record<string, GlyphStrokes | undefined>;

let cache: Promise<StrokeMap> | null = null;

/** Load the stroke map once and reuse it. The dynamic import is the code-split
 * point — the JSON is fetched the first time this runs, never at page load. */
function loadStrokes(): Promise<StrokeMap> {
  if (!cache) {
    cache = import("@/data/generated/strokes/hiragana.json").then(
      // The JSON infers `numbers` as number[][]; the pairs are [x, y] by
      // construction (scripts/ingest/kanjivg.mjs), so narrow through unknown.
      (m) => (m.default ?? m) as unknown as StrokeMap,
    );
  }
  return cache;
}

/** The three states the stroke data can be in for a glyph: still resolving, or
 * resolved to its strokes (or to null when there's no data for this glyph). */
export type StrokeLoad =
  | { status: "loading" }
  | { status: "ready"; data: GlyphStrokes | null };

/**
 * Stroke data for one glyph, lazily. Returns `loading` until the asset resolves,
 * then `ready` with the glyph's strokes — or `ready` with `null` when this glyph
 * isn't in the set yet (katakana, kanji), which the caller renders as the
 * whole-shape fallback rather than a diagram.
 */
export function useGlyphStrokes(glyph: string): StrokeLoad {
  const [state, setState] = useState<StrokeLoad>({ status: "loading" });

  useEffect(() => {
    let live = true;
    // Reset to loading when the glyph changes, so a new glyph never shows the
    // previous one's diagram for a frame. Same synchronous-in-effect shape as
    // lesson-prefs.ts's hydration, and disabled for the same reason.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" });
    loadStrokes()
      .then((map) => {
        if (live) setState({ status: "ready", data: map[glyph] ?? null });
      })
      .catch(() => {
        // Asset failed to load — degrade to the whole-shape fallback, no throw.
        if (live) setState({ status: "ready", data: null });
      });
    return () => {
      live = false;
    };
  }, [glyph]);

  return state;
}
