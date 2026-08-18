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
  RADICAL_GLYPHS,
} from "@/data/generated/strokes/kanji-index";
import { yoonParts } from "@/lib/library/kana-family";
import { pathBBox, transformPathD } from "@/lib/svg-path";

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

/** The non-jōyō radical/variant glyphs the ingest additionally covered (禾, 氵,
 * 亻 …), as a Set built once on first ask — the same lazy, synchronous,
 * fetch-free membership test as `isJouyou`, over the second string the generated
 * index exports. A radical that IS a jōyō kanji (水, 木) answers via `isJouyou`;
 * this set is only the remainder. */
let radicalGlyphs: Set<string> | null = null;
function isRadicalGlyph(glyph: string): boolean {
  radicalGlyphs ??= new Set([...RADICAL_GLYPHS]);
  return radicalGlyphs.has(glyph);
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
  // Kanji AND the radical/variant glyphs the ingest covered: only the ones
  // actually ingested, and then the codepoint picks the chunk (both sets live in
  // the same cp%N chunks). A glyph in neither set gets null and no fetch at all.
  // See isJouyou / isRadicalGlyph above.
  if (isJouyou(glyph) || isRadicalGlyph(glyph)) return `kanji-${cp % KANJI_CHUNKS}`;
  return null;
}

// SAK-72 PART B — COMPOSING A YŌON KANA'S DIAGRAM FROM TWO INGESTED GLYPHS
// ============================================================================
// きゃ has no precomposed KanjiVG entry: only き (the base, ingested since
// Part A) and ゃ (the small kana, ingested by this pass — see
// scripts/ingest/kanjivg.mjs's SETS) are real digitized characters. Both are
// drawn to fill their OWN 109×109 grid, the same way every glyph is — ゃ is
// not pre-shrunk or pre-positioned for sitting next to another character, it
// is just a visually smaller SHAPE at full-grid scale, because that is what a
// small kana looks like drawn on its own.
//
// So composing them means: keep き's strokes exactly as ingested (every
// EXISTING single-glyph call site must keep rendering byte-for-byte
// identically — this is strictly additive), and shrink + reposition ゃ's
// strokes into the glyph's lower-right corner, the way a small kana actually
// sits when fused onto the kana before it.
//
// THE SCALE AND OFFSET ARE COMPUTED, NOT HAND-TUNED PER PAIR
// ============================================================
// A fixed offset that happens to look right for き+ゃ would not generalise —
// し's bounding box is a different shape from き's, ゅ's from ゃ's. So the
// transform is derived at compose time from the SMALL glyph's own measured
// bounding box (via pathBBox) and a fixed TARGET box anchored to the stroke
// grid's bottom-right corner: scale the small glyph down until its longer
// dimension fits SMALL_KANA_BOX, then translate so its (scaled) bottom-right
// corner lands on the grid's bottom-right corner, inset by SMALL_KANA_MARGIN.
// This is the same math for every base+small pair, hiragana or katakana, and
// was checked against real ingested data for three of them (き+ゃ, し+ゅ,
// キ+ャ) before landing — see this ticket's own investigation notes.
const SMALL_KANA_BOX = 46;
const SMALL_KANA_MARGIN = 6;

/** Compose a base glyph's stroke data with a small kana's, for one yōon
 * diagram. `numbers` (the stroke-order label positions) are transformed the
 * same way, so a future consumer of those positions stays correct too, even
 * though StrokeOrder itself only reads `strokes.length` today. Exported for
 * the test — the one place this ticket's composition math is checked. */
export function composeGlyphStrokes(base: GlyphStrokes, small: GlyphStrokes): GlyphStrokes {
  const bbox = small.strokes.reduce(
    (acc, d) => {
      const b = pathBBox(d);
      return {
        xmin: Math.min(acc.xmin, b.xmin),
        xmax: Math.max(acc.xmax, b.xmax),
        ymin: Math.min(acc.ymin, b.ymin),
        ymax: Math.max(acc.ymax, b.ymax),
      };
    },
    { xmin: Infinity, xmax: -Infinity, ymin: Infinity, ymax: -Infinity },
  );
  const width = bbox.xmax - bbox.xmin;
  const height = bbox.ymax - bbox.ymin;
  const scale = SMALL_KANA_BOX / Math.max(width, height, 1);
  const corner = STROKE_GRID - SMALL_KANA_MARGIN;
  const tx = corner - bbox.xmax * scale;
  const ty = corner - bbox.ymax * scale;
  const affine = { scale, tx, ty };

  return {
    strokes: [...base.strokes, ...small.strokes.map((d) => transformPathD(d, affine))],
    numbers: [
      ...base.numbers,
      ...small.numbers.map(([x, y]): [number, number] => [
        Math.round((x * scale + tx) * 1000) / 1000,
        Math.round((y * scale + ty) * 1000) / 1000,
      ]),
    ],
  };
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

/** One glyph's strokes, fetched via its own scriptOf/loadStrokes resolution —
 * the single-glyph path both the plain lookup and the yōon composer below
 * share, so a base kana's own lookup (unchanged from before this pass) and a
 * yōon combo's two-part fetch go through exactly the same asset resolution. */
async function glyphStrokes(glyph: string): Promise<GlyphStrokes | null> {
  const asset = scriptOf(glyph);
  if (!asset) return null;
  const map = await loadStrokes(asset);
  return map[glyph] ?? null;
}

/**
 * Stroke data for one glyph, lazily. Returns `loading` until the asset resolves,
 * then `ready` with the glyph's strokes — or `ready` with `null` when this glyph
 * isn't in the ingested set (a non-jōyō kanji, punctuation), which the caller
 * renders as the whole-shape fallback rather than a diagram.
 *
 * A YŌON COMBO IS TWO FETCHES, COMPOSED
 * ======================================
 * scriptOf() rejects きゃ outright (it's "single character only" by design —
 * see that function's own doc comment, and strokes.test.ts's pin that a
 * multi-character string never triggers an asset fetch, which must stay true
 * for words like これ). So a yōon combo is detected FIRST, via yoonParts —
 * gated on CHAR_INDEX, so only the 72 glyphs the app actually teaches this way
 * ever take this branch — and its two halves are fetched independently
 * through the exact same glyphStrokes() a plain single glyph uses, then
 * merged by composeGlyphStrokes. Every other multi-character string (これ,
 * がっこう, a kanji word) has no yoonParts match and falls through to the
 * unchanged scriptOf path below, which still answers null for it.
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

    const combo = yoonParts(glyph);
    if (combo) {
      const [base, small] = combo;
      Promise.all([glyphStrokes(base), glyphStrokes(small)])
        .then(([baseData, smallData]) => {
          if (!live) return;
          setState({
            status: "ready",
            data: baseData && smallData ? composeGlyphStrokes(baseData, smallData) : null,
          });
        })
        .catch(() => {
          if (live) setState({ status: "ready", data: null });
        });
      return () => {
        live = false;
      };
    }

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
