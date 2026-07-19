"use client";

// Stroke-order data: lazy access to the KanjiVG-derived asset.
//
// WHY IT LOADS THE WAY IT DOES
// ============================
// The stroke data (src/data/generated/strokes/) is only ever needed once the
// learner OPENS "how it's written" on a glyph that has it. So it is not imported
// at module load — it would ride into the client bundle for every screen that
// never expands the section. Instead `loadStrokes()` does a dynamic import the
// first time it's asked, which the bundler code-splits into its own chunk
// fetched on demand, and caches the promise so a second glyph doesn't refetch.
// The section stays lean until it's actually used.
//
// The lookup picks the file from the glyph's codepoint, so a hiragana lesson
// never pulls the katakana asset and a kanji pulls exactly one of the 48 kanji
// chunks — never all of them, and never a chunk it isn't in.
//
// WHY KANJI IS 48 FILES AND KANA IS ONE EACH
// ==========================================
// 46 kana are 15KB, so one file per script costs nothing. The 2,136 jōyō kanji
// are 2.2MB, and pulling 2.2MB to draw ONE character is exactly why kanji sat
// un-ingested. So the kanji asset is split, and the split is by CODEPOINT
// (`cp % KANJI_CHUNKS`) for the same reason the kana test below is a codepoint
// range: the chunk falls out of the glyph itself, with no glyph→file table for
// this file and the ingest to drift apart on. It is also even — the jōyō
// codepoints are scattered through the CJK block, so the modulo lands 35 to 55
// kanji (max 58KB) in each — and it is stable under Settings, which grade or
// teaching order would not be: the owner can reorder kanji, and a key derived
// from that order would move under a reader mid-session.
//
// Only the chunk id is computed here. The 48 literal `import()` specifiers a
// bundler needs in order to split them live in the GENERATED index beside the
// chunks (src/data/generated/strokes/kanji-index.ts), written by the same ingest
// run, so the list cannot fall behind the files it names.

import { useEffect, useState } from "react";

import {
  CHUNK_LOADERS,
  JOUYOU,
  KANJI_CHUNKS,
} from "@/data/generated/strokes/kanji-index";

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

/** The jōyō set, as a Set, built once on first ask.
 *
 * WHY MEMBERSHIP IS TESTED AT ALL, RATHER THAN JUST BUCKETING EVERY KANJI
 * ======================================================================
 * `cp % KANJI_CHUNKS` will happily name a chunk for 龘 or any other character
 * nobody ingested. Fetching that chunk would be a 50KB download for a lookup
 * that MUST miss — the same wasted-fetch bug the multi-character guard below
 * exists to stop. So a non-jōyō kanji settles to null here, before any network.
 *
 * The cost is honest: JOUYOU is a ~6KB string in the bundle. That is the price
 * of answering "is this ingested?" synchronously, and it is two orders of
 * magnitude below the 2.2MB it is gatekeeping. */
let jouyou: Set<string> | null = null;
function isJouyou(glyph: string): boolean {
  jouyou ??= new Set([...JOUYOU]);
  return jouyou.has(glyph);
}

/** Which ingested asset a glyph lives in, or null for anything not ingested
 * (a non-jōyō kanji, punctuation, the collapsed-section sentinel ""). Kana are
 * contiguous Unicode blocks and a kanji's chunk is its codepoint modulo the
 * chunk count, so the codepoint alone decides in every case — no table to keep
 * in sync.
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
/** One kanji chunk, named by its id: `kanji-7` is CHUNK_LOADERS[7]. */
export type KanjiChunk = `kanji-${number}`;
/** Everything the loader can be asked for: a kana script, or one kanji chunk. */
export type StrokeAsset = Script | KanjiChunk;

export function scriptOf(glyph: string): StrokeAsset | null {
  if ([...glyph].length !== 1) return null;
  const cp = glyph.codePointAt(0);
  if (cp === undefined) return null;
  if (cp >= 0x3041 && cp <= 0x309f) return "hiragana";
  if (cp >= 0x30a1 && cp <= 0x30ff) return "katakana";
  // Kanji: only the ones actually ingested, and then its codepoint picks the
  // chunk. Nothing outside the jōyō set can be in a chunk, so it gets null and
  // no fetch at all. See isJouyou above.
  if (isJouyou(glyph)) return `kanji-${cp % KANJI_CHUNKS}`;
  return null;
}

const cache: Partial<Record<StrokeAsset, Promise<StrokeMap>>> = {};

/** Load one asset's stroke map once and reuse it. Every `import()` behind this
 * is a code-split point — the JSON is fetched the first time that asset is asked
 * for, never at page load, and only the one asset in use is fetched.
 *
 * The JSON infers `numbers` as number[][]; the pairs are [x, y] by construction
 * (scripts/ingest/kanjivg.mjs), so narrow through unknown. */
function loadStrokes(asset: StrokeAsset): Promise<StrokeMap> {
  const hit = cache[asset];
  if (hit) return hit;
  // The kana specifiers are literal so the bundler can see and split both; a
  // template string here would defeat that. The kanji ones are literal too —
  // one per chunk, in the generated index, for the same reason.
  const pending = (
    asset === "hiragana"
      ? import("@/data/generated/strokes/hiragana.json")
      : asset === "katakana"
        ? import("@/data/generated/strokes/katakana.json")
        : CHUNK_LOADERS[Number(asset.slice("kanji-".length))]()
  ).then((m) => {
    const mod = m as { default?: unknown };
    return (mod.default ?? m) as unknown as StrokeMap;
  });
  cache[asset] = pending;
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
