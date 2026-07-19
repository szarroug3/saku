// Ingest the 214 classical Kangxi radicals and each jōyō kanji's radical.
//
// SOURCES (fetched, not committed -- same policy as build.py's dictionaries):
//   UnicodeData.txt   Unicode Character Database, https://www.unicode.org/Public/UCD/latest/ucd/
//                     The Kangxi Radicals block (U+2F00..U+2FD5) is the 214
//                     radicals in order; each name is the radical's meaning and
//                     its <compat> field points at the CJK unified glyph to show.
//   kanjidic2.xml     KANJIDIC2, CC BY-SA 4.0 (EDRDG). Gives every kanji its
//                     classical radical (<rad_value rad_type="classical">) and
//                     the radical glyphs' stroke counts.
//
// OUTPUT (committed generated JSON, read straight off disk by src/data):
//   src/data/generated/radicals.json        the 214 table: {num, glyph, meaning, strokes}
//   src/data/generated/kanji-radicals.json  { "<kanji>": <radical number>, ... } for all 2,136 jōyō
//
// This is a STANDALONE script on purpose: it does not touch build.py or
// regenerate kanji.json/order.json, so the radical data can be produced without
// re-cutting the 78MB dictionary ingest and risking drift in unrelated data.
//
// Run:
//   node scripts/ingest/radicals.mjs --src <dir with UnicodeData.txt + kanjidic2.xml>
//
// NOTHING HERE INVENTS DATA. Variant radical forms (氵 for 水) and Japanese
// bushu names (さんずい) are deliberately absent: Unicode's variant block mixes
// in Chinese-simplified forms and compatibility codepoints, so a correct
// Japanese variant map needs a verified curated source and is a follow-up. The
// record carries only what these two authoritative sources actually attest.

import fs from "node:fs";
import path from "node:path";

// The two radicals whose Kangxi glyph is the traditional form; Japan uses the
// shinjitai. KANJIDIC2 has no stroke count for the traditional glyph, which is
// how these two were found. Remapped to the form a Japanese learner reads.
const JP_GLYPH = new Map([
  ["戶", "戸"], // 63 door
  ["靑", "青"], // 174 blue
]);

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

function loadUnicodeRadicals(udPath) {
  const lines = fs.readFileSync(udPath, "utf8").split("\n");
  const rads = [];
  for (const line of lines) {
    const f = line.split(";");
    if (!f[0]) continue;
    const cp = parseInt(f[0], 16);
    if (cp < 0x2f00 || cp > 0x2fd5) continue;
    const num = cp - 0x2f00 + 1;
    const compat = f[5].match(/<compat> ([0-9A-F]+)/);
    if (!compat) throw new Error(`radical ${num} (${f[1]}) has no unified glyph`);
    let glyph = String.fromCodePoint(parseInt(compat[1], 16));
    glyph = JP_GLYPH.get(glyph) ?? glyph;
    const meaning = f[1].replace(/^KANGXI RADICAL /, "").toLowerCase();
    rads.push({ num, glyph, meaning });
  }
  rads.sort((a, b) => a.num - b.num);
  return rads;
}

function loadKanjidic(kdPath) {
  const xml = fs.readFileSync(kdPath, "utf8");
  const chars = xml.split("<character>").slice(1);
  const radOf = new Map();
  const strokeOf = new Map();
  for (const c of chars) {
    const lit = c.match(/<literal>(.*?)<\/literal>/)?.[1];
    if (!lit) continue;
    const rad = c.match(/<rad_value rad_type="classical">(\d+)<\/rad_value>/)?.[1];
    const st = c.match(/<stroke_count>(\d+)<\/stroke_count>/)?.[1];
    if (rad) radOf.set(lit, Number(rad));
    if (st) strokeOf.set(lit, Number(st));
  }
  return { radOf, strokeOf };
}

function main() {
  const src = arg("--src");
  if (!src) {
    console.error("usage: node scripts/ingest/radicals.mjs --src <dir>");
    process.exit(1);
  }
  const here = path.dirname(new URL(import.meta.url).pathname);
  const outDir = path.resolve(here, "../../src/data/generated");

  const rads = loadUnicodeRadicals(path.join(src, "UnicodeData.txt"));
  const { radOf, strokeOf } = loadKanjidic(path.join(src, "kanjidic2.xml"));

  const table = rads.map((r) => {
    const strokes = strokeOf.get(r.glyph);
    if (strokes == null) {
      throw new Error(`radical ${r.num} ${r.glyph} has no stroke count in kanjidic2`);
    }
    return { num: r.num, glyph: r.glyph, meaning: r.meaning, strokes };
  });
  if (table.length !== 214) throw new Error(`expected 214 radicals, got ${table.length}`);

  const kanji = JSON.parse(
    fs.readFileSync(path.join(outDir, "kanji.json"), "utf8"),
  );
  const kanjiRad = {};
  const missing = [];
  for (const k of kanji) {
    const r = radOf.get(k.c);
    if (!r) missing.push(k.c);
    else kanjiRad[k.c] = r;
  }
  if (missing.length) {
    throw new Error(`no classical radical for ${missing.length} kanji: ${missing.slice(0, 20).join(" ")}`);
  }

  fs.writeFileSync(
    path.join(outDir, "radicals.json"),
    JSON.stringify(table) + "\n",
  );
  fs.writeFileSync(
    path.join(outDir, "kanji-radicals.json"),
    JSON.stringify(kanjiRad) + "\n",
  );

  const used = new Set(Object.values(kanjiRad));
  const orphans = table.filter((r) => !used.has(r.num)).map((r) => r.num);
  console.log(`radicals: ${table.length}  kanji mapped: ${Object.keys(kanjiRad).length}`);
  console.log(`radicals with a jōyō consumer: ${used.size}  orphans: ${orphans.length} (${orphans.join(" ")})`);
}

main();
