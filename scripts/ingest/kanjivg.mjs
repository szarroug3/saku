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

// SAK-72 Part A: the 50 dakuten/handakuten glyphs (が…ぽ, ガ…ポ) are each their
// own precomposed codepoint in KanjiVG, fully and correctly digitized (が = か's
// 3 strokes + 2 dakuten strokes, hand-placed; the exact placement varies per
// host glyph, e.g. ぎ's mark sits at different coordinates than が's — this is
// real per-glyph data, not a fixed offset applied here). Read from
// DAKUTEN_ROWS rather than typed out here, so this list can never drift from
// the app's own definition of "every dakuten/handakuten kana" — see that
// file's header for the row/pair shape.
import { DAKUTEN_ROWS } from "@/data/dakuten-rows";
// SAK-72 Part B: きゃ (a yōon combo) has no precomposed KanjiVG entry of its
// own — only its base kana (already ingested) and its SMALL kana are real
// digitized characters. The small kana were never pulled in, because nothing
// needed them standalone until the app started composing two independently-
// ingested glyphs into one diagram (see src/lib/strokes.ts's
// composeGlyphStrokes). Read from SMALL_TO_FULL_HIRAGANA's keys — the same
// table kana-family.ts's combo logic already uses to name "the taught small
// kana" — rather than typed out here, for the same never-drift reason as
// dakutenGlyphs above.
import { SMALL_TO_FULL_HIRAGANA } from "@/lib/library/kana-family";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OUTDIR = resolve(REPO, "src/data/generated/strokes");
const GENDIR = resolve(REPO, "src/data/generated");

/** Every converted glyph DAKUTEN_ROWS teaches for one script ("hiragana" or
 * "katakana"), in the rows' own teaching order (k→g, s→z, t→d, h→b, h→p) — 25
 * glyphs per script, 50 total. */
function dakutenGlyphs(setId) {
  return DAKUTEN_ROWS.filter((r) => r.setId === setId).flatMap((r) =>
    r.pairs.map(([, converted]) => converted),
  );
}

const KATAKANA_OFFSET = 0x60;

/** The three small kana a yōon combo fuses onto its base — ゃゅょ for
 * hiragana, ャュョ for katakana, in the same order both scripts. The katakana
 * trio is the hiragana one's own codepoints shifted by the fixed +0x60 offset
 * between the two contiguous kana blocks (the same offset kana-family.ts's
 * katakanaOf/twinOf use), not a second hand-typed list — one source
 * (SMALL_TO_FULL_HIRAGANA's keys), two scripts. */
function smallYoonGlyphs(setId) {
  const hiragana = Object.keys(SMALL_TO_FULL_HIRAGANA);
  if (setId === "hiragana") return hiragana;
  return hiragana.map((g) => String.fromCodePoint(g.codePointAt(0) + KATAKANA_OFFSET));
}

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
 * (vowels, K/S/T/N/H/M/Y/R/W rows, ん/ン), THEN the 25 dakuten/handakuten glyphs
 * DAKUTEN_ROWS teaches for that script, THEN (SAK-72 Part B) the 3 small yōon
 * kana (ゃゅょ / ャュョ). New glyphs are APPENDED, never interleaved, so a
 * re-run's output keeps every prior run's keys first and in their original
 * order — a diff against a prior run reads as pure addition, the property the
 * SAK-72 ingest explicitly has to preserve. Kanji is handled separately below
 * — it is chunked, and its glyph list comes from the app's own data. */
const SETS = [
  {
    name: "hiragana",
    glyphs: [
      ..."あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
      ...dakutenGlyphs("hiragana"),
      ...smallYoonGlyphs("hiragana"),
    ],
  },
  {
    name: "katakana",
    glyphs: [
      ..."アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
      ...dakutenGlyphs("katakana"),
      ...smallYoonGlyphs("katakana"),
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

/** The kanji's DIRECT (depth-1) components, from KanjiVG's `kvg:element` group
 * hierarchy — NOT KRADFILE's flat radical index, which mislabels the person
 * radical 亻 as 化 and flattens 時 to 寸+土+日 instead of 日+寺. See the
 * COMPONENTS header block below for the full rationale.
 *
 * KanjiVG nests one `<g kvg:element="…">` per meaningful component, so 休 is
 *   <g 休> <g 亻 original=人> <g 木> — direct children 亻 + 木
 * and 時 is
 *   <g 時> <g 日> <g 寺> <g 土> <g 寸> — direct children 日 + 寺, with 土/寸
 * nested UNDER 寺. Taking the root group's direct element-bearing children is
 * exactly "stop at the first meaningful level": it keeps the phonetic (寺) and
 * cannot reproduce the 亻→化 confusion, because this source never writes 化.
 *
 * We must know NESTING DEPTH, so a flat regex over `<g>` is not enough — we walk
 * the open/close structure with a stack and record each element group's nearest
 * element-bearing ancestor. Stroke counts come free: every `<path>` charges each
 * open element group, so a component's path total IS its stroke count (寺 = 6,
 * 亻 = 2), which is how a non-jōyō component that has no KANJIDIC2 row still
 * gets a measured stroke count.
 *
 * Returns { self, comps: [{ element, original, position, strokes }] } where
 * `comps` are the depth-1 children in drawing order (duplicates kept: 林 is 木 +
 * 木), or null if the SVG carries no element hierarchy at all. `position` is
 * KanjiVG's `kvg:position` on the group (left/right/top/bottom/nyo/…), where the
 * source records one — it says WHERE a variant form sits inside the host. */
function parseComponents(svg) {
  const tokenRe = /<g\b([^>]*)>|<\/g>|<path\b/g;
  const stack = []; // one frame per open <g>, { nodeIdx: number | null }
  const nodes = []; // { element, original, position, parentIdx, strokes }
  let m;
  while ((m = tokenRe.exec(svg))) {
    if (m[0] === "</g>") {
      stack.pop();
    } else if (m[0] === "<path") {
      // Charge this stroke to every enclosing element group, so a component's
      // stroke count is the number of paths anywhere beneath it.
      for (const f of stack) if (f.nodeIdx != null) nodes[f.nodeIdx].strokes++;
    } else {
      const attrs = m[1];
      const element = /kvg:element="([^"]*)"/.exec(attrs)?.[1] ?? null;
      let nodeIdx = null;
      if (element != null) {
        const original = /kvg:original="([^"]*)"/.exec(attrs)?.[1] ?? null;
        const position = /kvg:position="([^"]*)"/.exec(attrs)?.[1] ?? null;
        // Parent in the ELEMENT tree = nearest open group that bears an element,
        // so intermediate non-element <g> wrappers do not shift the depth.
        let parentIdx = null;
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].nodeIdx != null) {
            parentIdx = stack[i].nodeIdx;
            break;
          }
        }
        nodeIdx = nodes.length;
        nodes.push({ element, original, position, parentIdx, strokes: 0 });
      }
      stack.push({ nodeIdx });
    }
  }
  const rootIdx = nodes.findIndex((n) => n.parentIdx === null);
  if (rootIdx < 0) return null;
  const comps = nodes
    .filter((n) => n.parentIdx === rootIdx)
    .map((n) => ({
      element: n.element,
      original: n.original,
      position: n.position,
      strokes: n.strokes,
    }));
  return { self: nodes[rootIdx].element, comps };
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
  // `tree` is the component hierarchy (kanji only; kana callers ignore it). It
  // rides on the same fetch as the strokes so the two can never disagree about a
  // character — they come from one file.
  return { strokes, numbers, tree: parseComponents(svg) };
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

/** The radical + variant-form glyphs the app teaches, from the SAME generated
 * data the radical Library pages read. Many are also jōyō kanji (水, 木, 人) and
 * already have stroke data from the jōyō pass; the non-jōyō remainder (禾, 氵,
 * 亻 …) is the coverage this adds, so a radical page draws a real stroke-order
 * diagram instead of the count-only fallback. */
async function radicalGlyphs() {
  const rad = JSON.parse(
    await readFile(resolve(REPO, "src/data/generated/radicals.json"), "utf-8"),
  );
  const enr = JSON.parse(
    await readFile(resolve(REPO, "src/data/generated/radical-enrichment.json"), "utf-8"),
  );
  const set = new Set();
  for (const r of rad) set.add(r.glyph);
  for (const g of Object.keys(enr)) for (const v of enr[g].variants ?? []) set.add(v.glyph);
  return [...set];
}

/** The generated loader index. It exists because a bundler can only code-split
 * an `import()` whose specifier is a LITERAL, so the 48 specifiers have to be
 * written out somewhere — and written out by the script that writes the chunks,
 * so the list cannot fall behind them. */
function indexSource(keptKanji, keptRadicals) {
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
 * as one string of ${keptKanji.length} characters.
 *
 * The loader needs a membership test it can answer SYNCHRONOUSLY and without a
 * fetch: a character outside this set has no entry in any chunk, so resolving it
 * to a chunk id would buy a download that is guaranteed to miss — the same
 * wasted-fetch bug the multi-character guard in strokes.ts exists to prevent.
 * A flat string rather than a Set literal because it is a third of the source
 * size and the loader builds the Set once, lazily, on first use. */
export const JOUYOU =
  "${keptKanji.join("")}";

/** The NON-jōyō radical and variant-form glyphs this ingest produced stroke data
 * for (禾, 氵, 亻 …), sorted by codepoint, as one string of ${keptRadicals.length}
 * characters. Kept SEPARATE from JOUYOU so that string stays a faithful jōyō set;
 * scriptOf tests membership in either. These live in the same cp%N chunks — the
 * codepoint alone still decides the file — so this only answers the same
 * synchronous, fetch-free "is it ingested?" question JOUYOU does. */
export const RADICAL_GLYPHS =
  "${keptRadicals.join("")}";

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
    for (const g of glyphs) {
      // Kana carry no component hierarchy worth keeping; drop `tree` so the kana
      // asset stays exactly {strokes, numbers}.
      const { strokes, numbers } = await ingestGlyph(g);
      out[g] = { strokes, numbers };
    }
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
  const jGlyphs = await jouyou();
  const jSet = new Set(jGlyphs);
  // Radical/variant glyphs the jōyō pass doesn't already cover (禾, 氵, 亻 …).
  // They ride in the SAME cp%N chunks as the kanji — one codepoint-keyed scheme.
  const extraRadicals = (await radicalGlyphs()).filter((g) => !jSet.has(g));
  const toFetch = [...jGlyphs, ...extraRadicals];
  console.log(
    `kanji: ${jGlyphs.length} jōyō + ${extraRadicals.length} non-jōyō radical/variant ` +
      `glyphs, ${CONCURRENCY} fetches in flight…`,
  );

  const got = new Map();
  const failed = [];
  let done = 0;
  await pool(toFetch, async (g) => {
    // One retry: raw.github occasionally resets a connection under a pool, and
    // dropping a glyph over a transport blip would be silly.
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
    if (++done % 200 === 0) console.log(`  …${done}/${toFetch.length}`);
  });

  // Sort by codepoint so a re-run diffs cleanly, then bucket. The stroke chunks
  // keep only {strokes, numbers} — the component `tree` is written separately.
  const kept = [...got.keys()].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  const buckets = Array.from({ length: KANJI_CHUNKS }, () => ({}));
  for (const g of kept) {
    const { strokes, numbers } = got.get(g);
    buckets[chunkOf(g)][g] = { strokes, numbers };
  }

  let total = 0;
  let largest = 0;
  for (let n = 0; n < KANJI_CHUNKS; n++) {
    const json = JSON.stringify(buckets[n]) + "\n";
    const bytes = Buffer.byteLength(json);
    total += bytes;
    largest = Math.max(largest, bytes);
    await writeFile(resolve(OUTDIR, `${chunkName(n)}.json`), json);
  }

  // Two membership strings, split from the same kept set: JOUYOU stays EXACTLY
  // the jōyō kanji, RADICAL_GLYPHS carries the non-jōyō radical/variant glyphs
  // this run added. scriptOf routes a glyph in EITHER set to its chunk.
  const keptKanji = kept.filter((g) => jSet.has(g));
  const keptRadicals = kept.filter((g) => !jSet.has(g));
  await writeFile(
    resolve(OUTDIR, "kanji-index.ts"),
    indexSource(keptKanji, keptRadicals),
  );

  console.log(
    `wrote ${KANJI_CHUNKS} chunks — ${keptKanji.length}/${jGlyphs.length} jōyō + ` +
      `${keptRadicals.length}/${extraRadicals.length} radical/variant glyphs, ` +
      `${(total / 1024).toFixed(0)}KB total, largest ${(largest / 1024).toFixed(1)}KB`,
  );

  // Components are a JŌYŌ concern only — the radical additions must not change
  // kanji-components.json, so this walks the jōyō kept set with the jōyō
  // membership, exactly as before.
  await writeComponents(keptKanji, got, jSet);
  if (failed.length) {
    console.log(
      `SKIPPED ${failed.length} (KanjiVG has no usable SVG — these keep the fallback):`,
    );
    for (const { g, reason } of failed) {
      console.log(`  ${g} (${g.codePointAt(0).toString(16)}): ${reason}`);
    }
  }
}

// COMPONENTS: src/data/generated/kanji-components.json
// ====================================================
// The "Made of" row's data. Written from the SAME fetch as the stroke chunks,
// from KanjiVG's `kvg:element` hierarchy (see parseComponents). It replaces the
// KRADFILE-derived `comps` build.py used to bake into kanji.json, which had two
// factual defects the KanjiVG hierarchy structurally cannot reproduce:
//   1. KRADFILE encodes the person radical 亻 as 化, so 休 read 化+木 not 亻+木.
//   2. KRADFILE is a FLAT radical index, so 時 flattened to 寸+土+日, throwing
//      away 寺 — the phonetic shared with 持 待 詩 侍. Depth-1 keeps 日+寺.
//
// build.py reads THIS file for the kanji.json `comps` field and the
// components.json primitive stroke map (see scripts/ingest/build.py). Because
// build.py's glyph list is the jōyō set (invariant), and this script's only
// input from kanji.json is that same list, the two do not form a real cycle:
// run this script, then build.py.
//
// SHAPE
//   comps            { "休": ["亻","木"], … }  depth-1 children, self excluded,
//                    duplicates kept (林 → 木 + 木).
//   variants         { "亻":"人", "艹":"艸", … }  a component's kvg:original, so a
//                    learner meeting the variant form 亻 can tap through to the
//                    taught character 人. Only emitted where KanjiVG gives one.
//   variantPositions { "亻":"left", "氵":"left", … }  where each variant form sits
//                    inside its host, from kvg:position. The variant lesson uses
//                    it to say WHERE the reshaped form appears ("on the left, as
//                    in 体"). A form KanjiVG never positions is simply left out —
//                    variant-forms.ts fills those from a small authored table.
//                    When a form is seen in more than one position across hosts,
//                    the most frequent wins (first-seen breaks a tie).
//   primitiveStrokes { "亻":2, "匕":2, … }  stroke count for every component that
//                    is NOT itself a jōyō kanji — its only measurable fact, since
//                    no KANJIDIC2 row exists for it. From the path count under the
//                    component's group in the SVG.

async function writeComponents(kept, got, jset) {
  const comps = {};
  const variants = {};
  // variant element -> Map(position -> count seen across host kanji. The mode
  // wins below, so a form drawn 40 times on the left and once oddly still reads
  // "left". Insertion order (which breaks a count tie) is deterministic because
  // `kept` is walked in a fixed order, not fetch-completion order.
  const variantPositionCounts = new Map();
  // element -> stroke count. KanjiVG's granularity for a shape varies between
  // host characters — in some kanji a component's group holds every stroke, in
  // others a stroke is hoisted to a sibling — so we take the MAX seen, which is
  // the fully-articulated form (亠 as 2, not the 1 some hosts draw).
  const strokeMax = new Map();

  for (const g of kept) {
    const tree = got.get(g).tree;
    if (!tree) continue;
    // Depth-1 children, excluding the character itself (a pictograph whose only
    // element is itself yields no row — matching the old behaviour).
    const list = tree.comps.map((c) => c.element).filter((e) => e !== g);
    if (list.length) comps[g] = list;
    for (const c of tree.comps) {
      if (c.element === g) continue;
      if (c.original) {
        variants[c.element] = c.original;
        if (c.position) {
          const counts = variantPositionCounts.get(c.element) ?? new Map();
          counts.set(c.position, (counts.get(c.position) ?? 0) + 1);
          variantPositionCounts.set(c.element, counts);
        }
      }
      strokeMax.set(c.element, Math.max(strokeMax.get(c.element) ?? 0, c.strokes));
    }
  }
  // Collapse each variant's position histogram to its most frequent value.
  const variantPositions = {};
  for (const [element, counts] of variantPositionCounts) {
    let best = null;
    let bestN = -1;
    for (const [pos, n] of counts) {
      if (n > bestN) {
        best = pos;
        bestN = n;
      }
    }
    if (best) variantPositions[element] = best;
  }
  // Every component that is NOT itself a jōyō kanji gets a stroke count — its
  // only measurable fact, since no KANJIDIC2 row exists for it.
  const primitiveStrokes = {};
  for (const [element, strokes] of strokeMax) {
    if (!jset.has(element)) primitiveStrokes[element] = strokes;
  }

  // Stable key order for a clean diff.
  const sortObj = (o) =>
    Object.fromEntries(Object.keys(o).sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).map((k) => [k, o[k]]));
  const out = {
    comps: Object.fromEntries(kept.filter((g) => comps[g]).map((g) => [g, comps[g]])),
    variants: sortObj(variants),
    variantPositions: sortObj(variantPositions),
    primitiveStrokes: sortObj(primitiveStrokes),
  };
  const file = resolve(GENDIR, "kanji-components.json");
  await writeFile(file, JSON.stringify(out) + "\n");

  // Component-type census, for the report: (a) taught jōyō kanji, (b) a variant
  // of a taught kanji, (c) neither.
  const distinct = new Set();
  for (const g of kept) for (const e of comps[g] ?? []) distinct.add(e);
  let a = 0, b = 0, c = 0;
  for (const e of distinct) {
    if (jset.has(e)) a++;
    else if (variants[e] && jset.has(variants[e])) b++;
    else c++;
  }
  console.log(
    `wrote ${file} — ${Object.keys(out.comps).length} kanji with comps, ` +
      `${distinct.size} distinct components: (a) ${a} taught kanji, ` +
      `(b) ${b} variant-of-taught, (c) ${c} neither. ` +
      `${Object.keys(variantPositions).length} of ${Object.keys(variants).length} ` +
      `variants positioned. ` +
      `${Object.keys(primitiveStrokes).length} primitive stroke counts.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
