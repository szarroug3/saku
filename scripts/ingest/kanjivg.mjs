// Ingest KanjiVG stroke-order data into a lean generated asset.
//
// WHAT THIS PRODUCES
// ==================
// src/data/generated/strokes/hiragana.json, .../katakana.json and the 48
// .../kanji-NN.json chunks — files keyed by glyph, each value the ORDERED list of
// stroke `d` path strings plus the stroke-number label positions, on KanjiVG's
// native 109×109 grid. The renderer (src/components/lesson/stroke-order.tsx)
// draws straight from this: no SVG parsing at runtime, no per-glyph network
// request beyond the one lazy chunk. They are separate files so the loader
// fetches only the one asset the glyph in front of the learner lives in (see
// src/lib/strokes.ts).
//
// It also writes src/data/generated/strokes/kanji-index.ts — the generated
// module the loader goes through: the chunk count, the jōyō membership string,
// and the 48 literal `import()` thunks a bundler needs to see in order to split
// the chunks. It is written by THIS script alongside the chunks it indexes, so
// it cannot drift out of sync with them; nothing about it is hand-maintained.
//
// WHY KANJIVG
// ===========
// KanjiVG (github.com/KanjiVG/kanjivg) ships one SVG per character with its
// strokes as <path> elements IN DRAWING ORDER and a StrokeNumbers group giving
// the numeral positions. It covers hiragana, katakana AND kanji, so the same
// asset shape and the same renderer extend to all three scripts.
//
// WHY KANJI IS CHUNKED, AND HOW THE CHUNK IS CHOSEN
// =================================================
// 46 kana are 15KB. 2,136 jōyō kanji, with far more strokes each, are ~2.5MB —
// too much to pull whole to draw ONE character, which is why kanji ingest was
// deferred until it had a loading strategy. So the kanji output is split across
// KANJI_CHUNKS files and the loader fetches exactly one.
//
// The chunk is `codepoint % KANJI_CHUNKS`. Three things forced that:
//
//   - It is derivable FROM THE GLYPH ALONE, like scriptOf's codepoint ranges —
//     no glyph→chunk table for the loader and the ingest to disagree about.
//   - It is EVEN. Codepoints of the jōyō set are scattered across the CJK block,
//     so a modulo spreads them almost uniformly (35–55 per chunk at 48), where
//     slicing the codepoint RANGE into 48 pieces would follow the block's very
//     lumpy density.
//   - It is STABLE. Grade would be hopeless (grade 8 alone is 1,110 kanji), and
//     teaching order is worse than uneven: the owner can reorder kanji in
//     Settings, so an order-derived key would move under a reader mid-session
//     and point at the wrong file.
//
// The cost is that a chunk holds an arbitrary 45 kanji rather than related ones,
// so there is no locality to exploit — but there is none to exploit anyway, as a
// lesson walks kanji in teaching order, which no codepoint scheme tracks.
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
// and writes the JSON. Network access required; it fetches 2,228 small files at
// CONCURRENCY at a time, so it takes a few minutes. A character KanjiVG has no
// usable SVG for is REPORTED and SKIPPED, not written as an empty entry — the
// section falls back for it exactly as it does for a glyph never ingested.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OUTDIR = resolve(REPO, "src/data/generated/strokes");

/** How many files the kanji output is split across. 48 puts ~45 kanji and ~55KB
 * in each — small enough that opening one character is a normal-sized fetch,
 * few enough that the generated index stays readable. Must match KANJI_CHUNKS in
 * src/lib/strokes.ts, which is why that constant is re-exported from the
 * generated index this script writes rather than typed out in both places. */
const KANJI_CHUNKS = 48;

/** Parallel fetches. KanjiVG is a volunteer project served off raw.github; 8 in
 * flight is brisk without being rude. */
const CONCURRENCY = 8;

/** One output file per kana script: the 46 base glyphs of each, in gojūon order
 * (vowels, K/S/T/N/H/M/Y/R/W rows, ん/ン). Kanji is handled separately below —
 * it is chunked, and its glyph list comes from the app's own data. */
const SETS = [
  {
    name: "hiragana",
    glyphs: [
      ..."あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
    ],
  },
  {
    name: "katakana",
    glyphs: [
      ..."アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
    ],
  },
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

/** Fetch and parse one glyph. Throws rather than emitting a partial entry — a
 * glyph KanjiVG lacks must fail the run, not silently vanish from the asset.
 * (For kanji the caller catches, records and skips; see ingestKanji.)
 *
 * The filename is the zero-padded lowercase codepoint hex — 日 is 065e5.svg.
 * KanjiVG also ships VARIANT files for many characters (065e5-Kaisho.svg,
 * -Insatsu, -MidFude …), which are different typefaces' takes on the same
 * character; the unsuffixed file is the standard one and the only one we want,
 * and naming it exactly is already how we skip them. */
async function ingestGlyph(g) {
  const cp = g.codePointAt(0).toString(16).padStart(5, "0");
  const res = await fetch(`${RAW}/${cp}.svg`);
  if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
  const svg = await res.text();
  const strokes = parseStrokes(svg);
  if (!strokes.length) throw new Error("no strokes parsed from the SVG");
  const numbers = parseNumbers(svg);
  if (numbers.length !== strokes.length) {
    throw new Error(`${numbers.length} number labels for ${strokes.length} strokes`);
  }
  return { strokes, numbers };
}

/** Run `task` over `items` with at most CONCURRENCY in flight. A plain pool: N
 * workers pulling from one shared cursor, so a slow fetch doesn't stall the
 * others the way fixed batches would. */
async function pool(items, task) {
  let next = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await task(items[i], i);
    }
  });
  await Promise.all(workers);
}

/** Which chunk a glyph's data lives in. Codepoint alone decides — see the header
 * for why, and keep this identical to kanjiChunk() in src/lib/strokes.ts. */
function chunkOf(glyph) {
  return glyph.codePointAt(0) % KANJI_CHUNKS;
}

/** `kanji-07`, the basename both this script and the loader build. */
function chunkName(n) {
  return `kanji-${String(n).padStart(2, "0")}`;
}

/** The jōyō set, from the app's own kanji data rather than a list typed here:
 * the app and the stroke asset must agree on which kanji exist, and there is
 * exactly one source for that. */
async function jouyou() {
  const file = resolve(REPO, "src/data/generated/kanji.json");
  const rows = JSON.parse(await readFile(file, "utf-8"));
  return rows.map((r) => r.c);
}

/** The generated loader index. It exists because a bundler can only code-split
 * an `import()` whose specifier is a LITERAL, so the 48 specifiers have to be
 * written out somewhere — and written out by the script that writes the chunks,
 * so the list cannot fall behind them. */
function indexSource(kept) {
  const thunks = Array.from(
    { length: KANJI_CHUNKS },
    (_, n) => `  () => import("./${chunkName(n)}.json"),`,
  ).join("\n");
  return `// GENERATED by scripts/ingest/kanjivg.mjs — do not edit by hand.
//
// The kanji stroke chunks, and who is in them. Regenerate with
//   node scripts/ingest/kanjivg.mjs
//
// WHY THIS FILE EXISTS
// ====================
// A bundler can only code-split a dynamic import whose specifier is a literal,
// so the ${KANJI_CHUNKS} chunk specifiers must be spelled out. Spelling them out BY HAND
// would be a table to keep in sync with the chunks; spelling them out HERE, in
// the same run that writes the chunks, cannot drift. src/lib/strokes.ts decides
// WHICH chunk from the codepoint and comes here only to fetch it.
//
// Nothing in here is loaded eagerly except JOUYOU: the array holds thunks, so
// the chunk data is only fetched when one is called.

/** How many files the kanji stroke data is split across. */
export const KANJI_CHUNKS = ${KANJI_CHUNKS};

/** Every jōyō kanji this ingest produced stroke data for, sorted by codepoint,
 * as one string of ${kept.length} characters.
 *
 * The loader needs a membership test it can answer SYNCHRONOUSLY and without a
 * fetch: a character outside this set has no entry in any chunk, so resolving it
 * to a chunk id would buy a download that is guaranteed to miss — the same
 * wasted-fetch bug the multi-character guard in strokes.ts exists to prevent.
 * A flat string rather than a Set literal because it is a third of the source
 * size and the loader builds the Set once, lazily, on first use. */
export const JOUYOU =
  "${kept.join("")}";

/** The chunk loaders, indexed by chunk id. */
export const CHUNK_LOADERS: (() => Promise<unknown>)[] = [
${thunks}
];
`;
}

async function main() {
  await mkdir(OUTDIR, { recursive: true });
  for (const { name, glyphs } of SETS) {
    const out = {};
    for (const g of glyphs) out[g] = await ingestGlyph(g);
    // Keys in gojūon order for a stable diff; the data is the payload.
    const json = JSON.stringify(out) + "\n";
    const file = resolve(OUTDIR, `${name}.json`);
    await writeFile(file, json);
    console.log(
      `wrote ${file} — ${glyphs.length} glyphs, ${Buffer.byteLength(json)} bytes`,
    );
  }
  await ingestKanji();
}

async function ingestKanji() {
  const glyphs = await jouyou();
  console.log(`kanji: ${glyphs.length} jōyō, ${CONCURRENCY} fetches in flight…`);

  const got = new Map();
  const failed = [];
  let done = 0;
  await pool(glyphs, async (g) => {
    // One retry: raw.github occasionally resets a connection under a pool, and
    // dropping a kanji over a transport blip would be silly.
    for (let attempt = 0; ; attempt++) {
      try {
        got.set(g, await ingestGlyph(g));
        break;
      } catch (e) {
        if (attempt < 1) continue;
        failed.push({ g, reason: e.message });
        break;
      }
    }
    if (++done % 200 === 0) console.log(`  …${done}/${glyphs.length}`);
  });

  // Sort by codepoint so a re-run diffs cleanly, then bucket.
  const kept = [...got.keys()].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  const buckets = Array.from({ length: KANJI_CHUNKS }, () => ({}));
  for (const g of kept) buckets[chunkOf(g)][g] = got.get(g);

  let total = 0;
  let largest = 0;
  for (let n = 0; n < KANJI_CHUNKS; n++) {
    const json = JSON.stringify(buckets[n]) + "\n";
    const bytes = Buffer.byteLength(json);
    total += bytes;
    largest = Math.max(largest, bytes);
    await writeFile(resolve(OUTDIR, `${chunkName(n)}.json`), json);
  }

  await writeFile(resolve(OUTDIR, "kanji-index.ts"), indexSource(kept));

  console.log(
    `wrote ${KANJI_CHUNKS} kanji chunks — ${kept.length}/${glyphs.length} glyphs, ` +
      `${(total / 1024).toFixed(0)}KB total, largest ${(largest / 1024).toFixed(1)}KB`,
  );
  if (failed.length) {
    console.log(`SKIPPED ${failed.length}:`);
    for (const { g, reason } of failed) {
      console.log(`  ${g} (${g.codePointAt(0).toString(16)}): ${reason}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
