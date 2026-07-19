"use client";

// Stroke-order data: lazy access to the KanjiVG-derived asset.
//
// WHY IT LOADS THE WAY IT DOES
// ============================
// The stroke data (src/data/generated/strokes/{hiragana,katakana}.json) is only
// ever needed once the learner OPENS "how it's written" on a glyph that has it.
// So it is not imported at module load — it would ride into the client bundle
// for every screen that never expands the section. Instead `loadStrokes()` does
// a dynamic import the first time it's asked, which webpack code-splits into its
// own chunk fetched on demand, and caches the promise so a second glyph doesn't
// refetch. The section stays lean until it's actually used.
//
// One file per script, and the lookup picks the file from the glyph's codepoint,
// so a hiragana lesson never pulls the katakana chunk and vice versa.
//
// EXTENDING TO KANJI
// ==================
// Kanji is NOT ingested (scripts/ingest/kanjivg.mjs): it is megabytes and needs
// a loading strategy of its own — per-glyph or chunked, not one file pulled
// whole like these two. A glyph with no entry returns null and the caller falls
// back to "whole shape" — no crash. When kanji lands, add its source here; the
// renderer and the null-fallback contract don't change.

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

/** Which ingested asset a glyph lives in, or null for anything not ingested
 * (kanji, punctuation, the collapsed-section sentinel ""). Kana are contiguous
 * Unicode blocks, so the codepoint alone decides — no table to keep in sync.
 *
 * SINGLE CHARACTER ONLY, AND WHY THE GUARD LIVES HERE
 * ===================================================
 * The asset is keyed by ONE glyph. A multi-character string can never hit it:
 * a kana word like これ starts with hiragana, so testing the first codepoint
 * alone said "hiragana", the whole hiragana map was fetched over the network,
 * and `map["これ"]` missed anyway — a download paid for a guaranteed miss. The
 * length test sits here rather than at a call site because this is the ONE
 * funnel every lookup passes through on its way to a fetch, so a future caller
 * cannot route around it. Counted in codepoints, not UTF-16 units, so a glyph
 * outside the BMP still reads as one character.
 *
 * Exported for the test; the hook is the only runtime caller. */
export type Script = "hiragana" | "katakana";
export function scriptOf(glyph: string): Script | null {
  if ([...glyph].length !== 1) return null;
  const cp = glyph.codePointAt(0);
  if (cp === undefined) return null;
  if (cp >= 0x3041 && cp <= 0x309f) return "hiragana";
  if (cp >= 0x30a1 && cp <= 0x30ff) return "katakana";
  return null;
}

const cache: Partial<Record<Script, Promise<StrokeMap>>> = {};

/** Load one script's stroke map once and reuse it. Each `import()` is a
 * code-split point — the JSON is fetched the first time that script is asked
 * for, never at page load, and only the script actually in use is fetched.
 *
 * The JSON infers `numbers` as number[][]; the pairs are [x, y] by construction
 * (scripts/ingest/kanjivg.mjs), so narrow through unknown. */
function loadStrokes(script: Script): Promise<StrokeMap> {
  const hit = cache[script];
  if (hit) return hit;
  // The specifiers are literal so the bundler can see and split both chunks; a
  // template string here would defeat that.
  const pending = (
    script === "hiragana"
      ? import("@/data/generated/strokes/hiragana.json")
      : import("@/data/generated/strokes/katakana.json")
  ).then((m) => (m.default ?? m) as unknown as StrokeMap);
  cache[script] = pending;
  return pending;
}

/** The three states the stroke data can be in for a glyph: still resolving, or
 * resolved to its strokes (or to null when there's no data for this glyph). */
export type StrokeLoad =
  | { status: "loading" }
  | { status: "ready"; data: GlyphStrokes | null };

/**
 * Stroke data for one glyph, lazily. Returns `loading` until the asset resolves,
 * then `ready` with the glyph's strokes — or `ready` with `null` when this glyph
 * isn't in the ingested set (kanji), which the caller renders as the whole-shape
 * fallback rather than a diagram.
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
    const script = scriptOf(glyph);
    if (!script) {
      // Nothing ingested for this glyph — settle straight to the fallback
      // rather than fetching a chunk that couldn't contain it.
      setState({ status: "ready", data: null });
      return;
    }
    loadStrokes(script)
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
