// Ingest KanjiVG stroke-order data into a lean generated asset.
//
// WHAT THIS PRODUCES
// ==================
// src/data/generated/strokes/hiragana.json — keyed by glyph, each value the
// ORDERED list of stroke `d` path strings plus the stroke-number label
// positions, on KanjiVG's native 109×109 grid. The renderer
// (src/components/lesson/stroke-order.tsx) draws straight from this: no SVG
// parsing at runtime, no per-glyph network request beyond the one lazy chunk.
//
// WHY KANJIVG
// ===========
// KanjiVG (github.com/KanjiVG/kanjivg) ships one SVG per character with its
// strokes as <path> elements IN DRAWING ORDER and a StrokeNumbers group giving
// the numeral positions. It covers hiragana, katakana AND kanji, so the same
// asset shape and the same renderer extend to the other scripts later — add
// their codepoints to GLYPHS (or a sibling script) and re-run.
//
// LICENCE
// =======
// KanjiVG is CC BY-SA 3.0, © Ulrich Apel / KanjiVG contributors. The output is
// a derivative, so it is share-alike and lives under the src/data/generated/
// boundary (see src/data/generated/LICENSE and /NOTICE). BY-SA 3.0 → the
// project's BY-SA 4.0 is an allowed upgrade. Attribution is also shown in the
// UI, on the section itself.
//
// RUN
// ===
//   node scripts/ingest/kanjivg.mjs
// Fetches from the KanjiVG `master` branch (raw.githubusercontent.com), parses,
// and writes the JSON. Network access required; it fetches 46 small files.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OUT = resolve(REPO, "src/data/generated/strokes/hiragana.json");

/** The 46 base hiragana, in gojūon order. Katakana / kanji are a later run. */
const GLYPHS = [
  ..."あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
];

const RAW = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji";

/** Ordered stroke `d` strings for a glyph, from the KanjiVG SVG text. The paths
 * appear in drawing order in the file; each id ends in `-s<n>`. We sort by that
 * n defensively rather than trusting document order. */
function parseStrokes(svg) {
  const strokes = [...svg.matchAll(/<path\s+id="kvg:[^"]*-s(\d+)"[^>]*\bd="([^"]+)"/g)]
    .map((m) => ({ n: Number(m[1]), d: m[2] }))
    .sort((a, b) => a.n - b.n);
  return strokes.map((s) => s.d);
}

/** Stroke-number label positions, one per stroke, from the StrokeNumbers group.
 * Returned in stroke order so numbers[i] labels strokes[i]. */
function parseNumbers(svg) {
  const nums = [...svg.matchAll(
    /<text transform="matrix\(1 0 0 1 (-?[\d.]+) (-?[\d.]+)\)">(\d+)<\/text>/g,
  )]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), n: Number(m[3]) }))
    .sort((a, b) => a.n - b.n);
  return nums.map(({ x, y }) => [x, y]);
}

async function main() {
  const out = {};
  for (const g of GLYPHS) {
    const cp = g.codePointAt(0).toString(16).padStart(5, "0");
    const res = await fetch(`${RAW}/${cp}.svg`);
    if (!res.ok) throw new Error(`fetch ${g} (${cp}) failed: ${res.status}`);
    const svg = await res.text();
    const strokes = parseStrokes(svg);
    if (!strokes.length) throw new Error(`no strokes parsed for ${g} (${cp})`);
    const numbers = parseNumbers(svg);
    out[g] = { strokes, numbers };
  }
  await mkdir(dirname(OUT), { recursive: true });
  // Sorted keys for a stable diff; the data is the payload, not the order.
  const sorted = Object.fromEntries(GLYPHS.map((g) => [g, out[g]]));
  await writeFile(OUT, JSON.stringify(sorted) + "\n");
  const bytes = Buffer.byteLength(JSON.stringify(sorted) + "\n");
  console.log(`wrote ${OUT} — ${GLYPHS.length} glyphs, ${bytes} bytes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
