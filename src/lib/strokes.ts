// Stroke-order data: lazy access to the KanjiVG-derived asset.
//
// PURE ON PURPOSE — see use-glyph-strokes.ts for the hook. This file has no
// React import so it can be unit-tested directly under Node's test runner
// (see strokes.test.ts); a "use client" file importing `useEffect` at module
// scope fails Node's ESM resolution outside Next's own build pipeline, which
// is exactly what broke every test in this file before the split.
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

import {
  CHUNK_LOADERS,
  JOUYOU,
  KANJI_CHUNKS,
  RADICAL_GLYPHS,
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

const cache: Partial<Record<StrokeAsset, Promise<StrokeMap>>> = {};

/** Load one asset's stroke map once and reuse it. Every `import()` behind this
 * is a code-split point — the JSON is fetched the first time that asset is asked
 * for, never at page load, and only the one asset in use is fetched.
 *
 * The JSON infers `numbers` as number[][]; the pairs are [x, y] by construction
 * (scripts/ingest/kanjivg.mjs), so narrow through unknown. Exported for
 * use-glyph-strokes.ts's hook. */
export function loadStrokes(asset: StrokeAsset): Promise<StrokeMap> {
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
