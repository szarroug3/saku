// Enrich the 214 Kangxi radicals with their Japanese BUSHU NAME (kana + romaji,
// e.g. 禾 → のぎへん/nogihen) and their positional VARIANT FORMS (e.g. 水 → 氵, 氺;
// 人 → 亻; 刀 → 刂). scripts/ingest/radicals.mjs deliberately left these out —
// its two sources (Unicode UCD + KANJIDIC2) do not attest a Japanese variant
// map or bushu names, and its header says that "needs a verified curated
// source and is a follow-up." THIS is that source.
//
// SOURCES (fetched, not committed -- same policy as radicals.mjs):
//   japanese-radicals.csv     Kanji Alive (kanjialive/kanji-data-media),
//                             CC BY 4.0. The bushu names, positions and the
//                             list of which variant forms exist.
//     https://raw.githubusercontent.com/kanjialive/kanji-data-media/master/language-data/japanese-radicals.csv
//   EquivalentUnifiedIdeograph.txt  Unicode UCD, permissive Unicode licence.
//                             Normalises a radical-block glyph (Kangxi block
//                             U+2F00..U+2FD5, CJK Radicals Supplement
//                             U+2E80..U+2EFF) to the CJK unified ideograph it is
//                             a form of — this is how ⺡ (U+2EA1 CJK RADICAL
//                             WATER ONE) becomes 氵 (U+6C35), the glyph a learner
//                             actually reads. Kanji Alive stores variants as
//                             radical-block codepoints, not the CJK component.
//     https://www.unicode.org/Public/UCD/latest/ucd/EquivalentUnifiedIdeograph.txt
//
// OUTPUT (committed generated JSON, read straight off disk by src/data):
//   src/data/generated/radical-enrichment.json   keyed by Kangxi number "1".."214":
//     { "85": { "name": {"kana":"みず","romaji":"mizu"},
//               "variants": [ { "glyph":"氵",
//                               "name":{"kana":"さんずい","romaji":"sanzui"},
//                               "position":{"kana":"へん","romaji":"hen"} },
//                             { "glyph":"氺", "name":{"kana":"したみず","romaji":"shitamizu"} } ] } }
//
// HOW THE CSV IS JOINED TO OUR 214 (this is the whole trick)
// ==========================================================
// The CSV's `Radical ID#` column is NOT the Kangxi number in this cut of the
// file — it is a running row id (1..322). The Kangxi number is carried instead
// by the glyph: a BASE radical row's glyph is a Kangxi Radicals block codepoint
// (U+2F00 + num - 1), so num falls straight out of the codepoint. VARIANT rows
// are the other rows, and Kanji Alive does NOT reliably place them right after
// their base (a pile of the common へん/かんむり forms — さんずい, てへん, りっしんべん …
// — sits together after radical 60), so a positional walk mis-groups them. What
// DOES join a variant to its base is Kanji Alive's own `Meaning` column: a
// variant row repeats its base row's Meaning verbatim (さんずい's Meaning is
// "water", exactly 水's). So variants are grouped by matching Meaning to a base
// row's Meaning. The four base meanings that collide across two radicals ("self"
// 49/132, "split wood" 90/91, "leather" 177/178, "tripod" 193/206) are excluded
// from the meaning index; no cleanly-emitted variant falls in them.
//
// FOUR RADICALS HAVE NO KANGXI-BLOCK BASE ROW in this CSV (43 尢, 52 幺, 92 牙,
// 168 長): Kanji Alive lists only a variant/CRS/PUA row for them. Their base
// NAME is taken from that single attested row (だいのまげあし, いとがしら, きば, ながい)
// via the small EXPLICIT table below — every value still comes from the CSV,
// nothing is invented. The same table routes the handful of variant rows whose
// Meaning does not match their base's (川 さんぼんがわ under 巛; くさかんむり under 艸;
// けものへん under 犬; しんにょう under 辵; こざとへん under 阜; おおざと under 邑).
//
// WHAT IS DROPPED, AND WHY (reported at the end of a run, not silently)
// ====================================================================
//   - PUA glyphs. Kanji Alive draws many へん forms (うまへん, かねへん, とりへん …)
//     from a private font (U+E000..U+F8FF). Those forms have no distinct Unicode
//     codepoint — the component is just the base glyph in a position — so the
//     variant cannot be represented and is dropped. The base name is unaffected.
//   - A variant whose normalised glyph EQUALS its base glyph (⺌ しょうかんむり → 小;
//     おおざと → 邑). Same shape as the base under Unicode's equivalence; not a
//     distinct form to carry.
//   - A variant whose normalised glyph is ANOTHER radical's base glyph. Kanji
//     Alive labels U+2EAB (named "CJK RADICAL EYE", → 目) as あみがしら/net; the
//     glyph is 目, radical 109, not a net form, so it is dropped as a source
//     glyph error rather than filed under 网.
//   - Non-radical rows (⺍ "Katakana Tsu"; 々 the iteration mark).
//
// NOTHING HERE INVENTS DATA. Every name, romaji and position is a CSV field;
// every variant glyph is a CSV glyph normalised by the Unicode equivalence
// table. Rows that cannot be resolved to a Kangxi number, or whose glyph cannot
// be represented, are dropped and listed — never guessed.
//
// Run:
//   node scripts/ingest/radical-enrichment.mjs --src <dir with japanese-radicals.csv + EquivalentUnifiedIdeograph.txt>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, "..", "..");
const GEN = path.join(REPO, "src", "data", "generated");

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

// ---- tiny CSV reader (quoted fields with embedded commas) ------------------
function parseCsv(text) {
  const rows = [];
  let field = "";
  let record = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { record.push(field); rows.push(record); record = []; field = ""; }
    else field += c;
  }
  if (field.length || record.length) { record.push(field); rows.push(record); }
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

// ---- Unicode equivalent-unified-ideograph map ------------------------------
function loadEquiv(p) {
  const map = new Map();
  for (const raw of fs.readFileSync(p, "utf8").split("\n")) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [a, b] = line.split(";").map((x) => x.trim());
    const to = parseInt(b, 16);
    if (a.includes("..")) {
      const [lo, hi] = a.split("..").map((x) => parseInt(x, 16));
      for (let cp = lo; cp <= hi; cp++) map.set(cp, to);
    } else map.set(parseInt(a, 16), to);
  }
  return map;
}

const clean = (g) => (g ?? "").replace(/[\s ]+/g, "").trim();
const cp0 = (g) => g.codePointAt(0);
const isKangxiBlock = (g) => [...g].length === 1 && cp0(g) >= 0x2f00 && cp0(g) <= 0x2fd5;
const isPua = (g) => g.length > 0 && cp0(g) >= 0xe000 && cp0(g) <= 0xf8ff;
function isSingleCjk(g) {
  if ([...g].length !== 1) return false;
  const cp = cp0(g);
  return (
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0x20000 && cp <= 0x2fa1f) // CJK Extension B..F + compat supplement
  );
}

// Normalise a radical-block glyph to the CJK unified ideograph it is a form of.
function normGlyph(g, equiv) {
  if ([...g].length !== 1) return g;
  const eq = equiv.get(cp0(g));
  const u = eq !== undefined ? String.fromCodePoint(eq) : g;
  return u.normalize("NFC"); // collapses e.g. U+FA1E (compat 羽) → U+7FBD 羽
}

// Rows whose Meaning does not match their base, resolved to a Kangxi number by
// hand. `base` = this is the only attested row for a radical with no
// Kangxi-block base row, so take its NAME as the base name. `variant` = a real
// variant whose Meaning differs from the base's. Keyed by the CSV row's exact
// (Reading-R, Meaning) so it pins one specific row. Every value used still
// comes from that CSV row; this only says which radical it belongs to.
const EXPLICIT = new Map([
  ["dainomageashi lame leg", { role: "base", num: 43 }],
  ["itogashira young, slight", { role: "base", num: 52 }],
  ["kiba fang, canine tooth", { role: "base", num: 92 }],
  ["nagai long", { role: "base", num: 168 }],
  ["sanbongawa river", { role: "variant", num: 47 }],
  ["kusakanmuri grass", { role: "variant", num: 140 }],
  ["shinnyou road, walk, to advance", { role: "variant", num: 162 }],
  ["oozato village, country, city", { role: "variant", num: 163 }],
  ["kozatohen hill, mound", { role: "variant", num: 170 }],
  ["kemonohen beast", { role: "variant", num: 94 }],
]);

function main() {
  const src = arg("--src", ".");
  const rows = parseCsv(fs.readFileSync(path.join(src, "japanese-radicals.csv"), "utf8"));
  const equiv = loadEquiv(path.join(src, "EquivalentUnifiedIdeograph.txt"));

  // Our 214: Kangxi number → glyph, and glyph → number.
  const RADICALS = JSON.parse(fs.readFileSync(path.join(GEN, "radicals.json"), "utf8"));
  const glyphOfNum = new Map(RADICALS.map((r) => [r.num, r.glyph]));
  const numOfGlyph = new Map(RADICALS.map((r) => [r.glyph, r.num]));

  // Base rows: first Kangxi-block row for each number.
  const baseRow = new Map();
  for (const r of rows) {
    const g = clean(r.Radical);
    if (isKangxiBlock(g)) {
      const num = cp0(g) - 0x2f00 + 1;
      if (!baseRow.has(num)) baseRow.set(num, r);
    }
  }

  // Meaning → number, excluding meanings shared by two base radicals.
  const byMeaning = new Map();
  for (const [num, r] of baseRow) {
    const list = byMeaning.get(r.Meaning) ?? [];
    list.push(num);
    byMeaning.set(r.Meaning, list);
  }
  const meaningToNum = new Map();
  for (const [m, nums] of byMeaning) if (nums.length === 1) meaningToNum.set(m, nums[0]);

  const name = (r) => ({ kana: r["Reading-J"], romaji: r["Reading-R"] });
  const position = (r) =>
    clean(r["Position-R"]) ? { kana: r["Position-J"], romaji: r["Position-R"] } : undefined;

  const enrichment = new Map(); // num → { name, position?, variants: [] }
  for (let n = 1; n <= 214; n++) enrichment.set(n, { name: null, variants: [] });

  // Bases first.
  for (const [num, r] of baseRow) {
    const e = enrichment.get(num);
    e.name = name(r);
    const p = position(r);
    if (p) e.position = p;
  }

  const dropped = [];
  let usedKiba92 = false;

  for (const r of rows) {
    const g = clean(r.Radical);
    if (isKangxiBlock(g) && baseRow.get(cp0(g) - 0x2f00 + 1) === r) continue; // base, done

    const key = `${r["Reading-R"]} ${r.Meaning}`;
    let num;
    let role = "variant";
    if (meaningToNum.has(r.Meaning)) {
      num = meaningToNum.get(r.Meaning);
    } else if (EXPLICIT.has(key)) {
      const x = EXPLICIT.get(key);
      role = x.role;
      num = x.num;
      if (r["Reading-R"] === "kiba" && role === "base") {
        if (usedKiba92) { dropped.push({ reading: r["Reading-R"], why: "duplicate 牙(92) row" }); continue; }
        usedKiba92 = true;
      }
    }
    if (num === undefined) {
      dropped.push({ reading: r["Reading-R"] || "∅", meaning: r.Meaning || "∅", why: "no Kangxi number" });
      continue;
    }

    if (role === "base") {
      const e = enrichment.get(num);
      if (e.name === null) {
        e.name = name(r);
        const p = position(r);
        if (p) e.position = p;
      }
      continue;
    }

    // A variant. It must yield a single, representable CJK glyph distinct from
    // its base and not itself another radical's base.
    if (!g || isPua(g)) { dropped.push({ reading: r["Reading-R"], why: `PUA glyph → r${num}` }); continue; }
    const ng = normGlyph(g, equiv);
    if (ng === glyphOfNum.get(num)) { dropped.push({ reading: r["Reading-R"], why: `same as base r${num}` }); continue; }
    if (!isSingleCjk(ng)) { dropped.push({ reading: r["Reading-R"], why: `not single CJK (${ng}) r${num}` }); continue; }
    const owner = numOfGlyph.get(ng);
    if (owner !== undefined && owner !== num) {
      dropped.push({ reading: r["Reading-R"], why: `glyph ${ng} is base of r${owner}, not r${num}` });
      continue;
    }
    const e = enrichment.get(num);
    if (e.variants.some((v) => v.glyph === ng)) continue; // dedup
    const v = { glyph: ng, name: name(r) };
    const p = position(r);
    if (p) v.position = p;
    e.variants.push(v);
  }

  // Report + fail loudly if any of the 214 lacks a name (accuracy contract).
  const noName = [];
  const out = {};
  for (let n = 1; n <= 214; n++) {
    const e = enrichment.get(n);
    if (e.name === null) { noName.push(n); continue; }
    const rec = { name: e.name };
    if (e.position) rec.position = e.position;
    rec.variants = e.variants;
    out[String(n)] = rec;
  }
  if (noName.length) throw new Error(`radicals with no bushu name: ${noName.join(", ")}`);

  const withVariants = Object.values(out).filter((r) => r.variants.length).length;
  const totalVariants = Object.values(out).reduce((s, r) => s + r.variants.length, 0);

  const HEADER =
    "Japanese bushu names and positional variant forms for the 214 Kangxi " +
    "radicals. Names, positions and the set of variant forms are from Kanji " +
    "Alive (japanese-radicals.csv), CC BY 4.0 " +
    "(https://github.com/kanjialive/kanji-data-media). Variant glyphs are the " +
    "CSV's radical-block codepoints normalised to their CJK unified ideograph " +
    "via Unicode's EquivalentUnifiedIdeograph.txt. Generated by " +
    "scripts/ingest/radical-enrichment.mjs; do not edit by hand. See " +
    "src/data/generated/LICENSE and src/data/attribution.ts.";
  const payload = { _license: HEADER, ...out };

  fs.writeFileSync(
    path.join(GEN, "radical-enrichment.json"),
    JSON.stringify(payload, null, 1) + "\n",
  );

  console.log(`wrote radical-enrichment.json: 214 names, ${withVariants} radicals carry variants, ${totalVariants} variant forms total.`);
  console.log(`dropped ${dropped.length} rows (PUA/positional-only/non-radical):`);
  for (const d of dropped) console.log("  ", JSON.stringify(d));
}

main();
