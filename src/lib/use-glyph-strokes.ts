"use client";

// The React half of strokes.ts — split out so that file stays pure and
// unit-testable (see its own header note). Nothing here is new behavior,
// just the hook lifted out of the module it used to force a React import
// onto.

import { useEffect, useState } from "react";

import { loadStrokes, scriptOf, type StrokeLoad } from "@/lib/strokes";

/**
 * Stroke data for one glyph, lazily. Returns `loading` until the asset resolves,
 * then `ready` with the glyph's strokes — or `ready` with `null` when this glyph
 * isn't in the ingested set (a non-jōyō kanji, punctuation), which the caller
 * renders as the whole-shape fallback rather than a diagram.
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
    const asset = scriptOf(glyph);
    if (!asset) {
      // Nothing ingested for this glyph — settle straight to the fallback
      // rather than fetching a chunk that couldn't contain it.
      setState({ status: "ready", data: null });
      return;
    }
    loadStrokes(asset)
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
