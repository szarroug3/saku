// Full-run coverage over the committed kanji-etymology.json, computed through
// the REAL runtime join (builtFromRoles → the app's COMPS_OVERRIDE-corrected
// pieces). Run: node scripts/ingest/etymology-coverage.ts

import { KANJI, KANJI_ORDER, kanjiRow } from "../../src/data/kanji.ts";
import {
  builtFromRoles,
  builtPieces,
  etymologyOf,
  hasEtymology,
} from "../../src/data/kanji-etymology.ts";

const jouyou = KANJI_ORDER.map((r) => r.c);
const JOUYOU_SET = new Set(KANJI.map((k) => k.c));

let withType = 0;
let withComponents = 0;
// (withOrigin folded into withOriginText below)
let withOriginText = 0;
let totalPieces = 0;
let labeledSemantic = 0;
let labeledPhonetic = 0;
let labeledForm = 0;

const typeTally: Record<string, number> = {};
const originLens: number[] = [];
const unaligned: string[] = [];

for (const c of jouyou) {
  const etym = etymologyOf(c);
  if (!hasEtymology(c)) continue;
  if (etym?.type) {
    withType++;
    typeTally[etym.type] = (typeTally[etym.type] ?? 0) + 1;
  }
  if (etym && etym.components.length > 0) withComponents++;
  if (etym?.originText) {
    withOriginText++;
    originLens.push(etym.originText.length);
  }

  const roles = builtFromRoles(c);
  const pieces = kanjiRow(c)?.comps ?? [];
  totalPieces += pieces.length;
  let matchedHere = 0;
  for (const r of roles) {
    if (!r) continue;
    matchedHere++;
    if (r.function === "semantic") labeledSemantic++;
    else if (r.function === "phonetic") labeledPhonetic++;
    else if (r.function === "form") labeledForm++;
  }
  // A kanji with components but nothing aligned is part of the hand-curation tail.
  if (etym && etym.components.length > 0 && matchedHere < etym.components.length) {
    const unmatched = etym.components
      .filter(() => true)
      .map((k) => k.glyph);
    unaligned.push(
      `${c}  pieces[${pieces.join(" ")}]  wikt[${unmatched.join(" ")}]  matched ${matchedHere}/${etym.components.length}`,
    );
  }
}

originLens.sort((a, b) => a - b);
const max = originLens[originLens.length - 1] ?? 0;
const over120 = originLens.filter((n) => n > 120).length;

console.log(`jōyō total: ${jouyou.length}`);
console.log(`kanji with an etymology record: ${jouyou.filter(hasEtymology).length}`);
console.log(`  with a structure type: ${withType}`);
console.log(`  with >=1 component: ${withComponents}`);
console.log(`  with a glyph-origin explanation (originText): ${withOriginText}`);
console.log("\ntype breakdown:");
for (const [t, n] of Object.entries(typeTally).sort((a, b) => b[1] - a[1]))
  console.log(`  ${t}: ${n}`);

const labeled = labeledSemantic + labeledPhonetic + labeledForm;
console.log(`\nKanjiVG shape pieces (over kanji with a record): ${totalPieces}`);
console.log(`  labeled (matched a Wiktionary component): ${labeled}`);
console.log(`    semantic: ${labeledSemantic}`);
console.log(`    phonetic: ${labeledPhonetic}`);
console.log(`    form:     ${labeledForm}`);

console.log(`\noriginText length: longest ${max} chars; over ~1 line (>120): ${over120}/${originLens.length}`);
console.log(`\nunaligned tail (record has components, some/all pieces unmatched): ${unaligned.length}`);
for (const u of unaligned.slice(0, 15)) console.log("  " + u);
if (unaligned.length > 15) console.log(`  … and ${unaligned.length - 15} more`);

// ── Phonetic-reading derivation success + sound-bearing analysis ────────────
let phoneticPieces = 0;
let phoneticWithReading = 0;
for (const c of jouyou) {
  for (const p of builtPieces(c)) {
    if (p.role !== "phonetic") continue;
    phoneticPieces++;
    if (p.label) phoneticWithReading++;
  }
}
console.log(`\nphonetic pieces (in builtPieces): ${phoneticPieces}`);
console.log(`  with a derived reading: ${phoneticWithReading} (${((phoneticWithReading / phoneticPieces) * 100).toFixed(0)}%)`);

// Owner's question: are ALL phonetic-tagged COMPONENTS sound-bearing characters,
// and how many are jōyō vs rarer/non-jōyō? Look at the raw records, not the join.
const isUnifiedHan = (g: string) => {
  const cp = g.codePointAt(0) ?? 0;
  // CJK Unified Ideographs + Ext A/B (sound-bearing characters, as opposed to
  // radical-block glyphs like 冂 勹 which are not standalone characters).
  return (
    [...g].length === 1 &&
    ((cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x20000 && cp <= 0x2a6df))
  );
};
let phonComp = 0;
let phonJouyou = 0;
let phonNonJouyouHan = 0;
let phonRadicalLike = 0;
const radicalLike: string[] = [];
for (const c of jouyou) {
  const etym = etymologyOf(c);
  if (!etym) continue;
  for (const k of etym.components) {
    if (k.function !== "phonetic") continue;
    phonComp++;
    if (JOUYOU_SET.has(k.glyph)) phonJouyou++;
    else if (isUnifiedHan(k.glyph)) phonNonJouyouHan++;
    else {
      phonRadicalLike++;
      radicalLike.push(`${c}:${k.glyph}`);
    }
  }
}
console.log(`\nphonetic COMPONENTS in the raw records: ${phonComp}`);
console.log(`  jōyō kanji: ${phonJouyou}`);
console.log(`  non-jōyō but a unified Han character (sound-bearing): ${phonNonJouyouHan}`);
console.log(`  radical-block / non-character glyph (would be reading-less): ${phonRadicalLike}`);
if (radicalLike.length) console.log(`    ${radicalLike.slice(0, 30).join("  ")}`);
