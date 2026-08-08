// Dump a teaching-order slice of kanji whose etymology story still needs a
// plain-language rewrite, with everything an author needs to write it.
//
//   npx tsx scripts/etymology-prose-range.mts [START] [COUNT]
//
// With no args it prints only the remaining count. Already-cleaned kanji (in
// PROSE_OVERRIDE), number kanji, and kanji with no origin text are excluded, so
// the list shrinks as batches land and START/COUNT index into what's LEFT.

import { KANJI, KANJI_ORDER, kanjiRow } from "../src/data/kanji.ts";
import {
  etymologyOf,
  phoneticReading,
} from "../src/data/kanji-etymology.ts";
import { isNumberKanji } from "../src/data/number-kanji.ts";
import { PROSE_OVERRIDE, PROSE_SKIP } from "../src/data/kanji-etymology-prose.ts";

const order = KANJI_ORDER.map((o) => o.c);
const seen = new Set<string>();
const seq = [...order, ...KANJI.map((k) => k.c)].filter((c) => {
  if (seen.has(c)) return false;
  seen.add(c);
  return true;
});

const meaningOf = (k: string) => kanjiRow(k)?.meanings?.slice(0, 3).join(", ") ?? "";

const remaining = seq.filter((k) => {
  if (isNumberKanji(k)) return false;
  if (k in PROSE_OVERRIDE) return false;
  if (PROSE_SKIP.has(k)) return false;
  const t = etymologyOf(k)?.originText;
  return typeof t === "string" && t.trim().length > 0;
});

console.log(`REMAINING (need plain-language rewrite): ${remaining.length}`);

const START = Number(process.argv[2] ?? -1);
const COUNT = Number(process.argv[3] ?? 0);
if (START < 0) process.exit(0);

for (let i = START; i < START + COUNT && i < remaining.length; i++) {
  const k = remaining[i];
  const e = etymologyOf(k)!;
  console.log(`\n[${i}] ${k}  「${meaningOf(k)}」  type: ${e.type ?? "none"}`);
  const parts = e.components.map((c) => {
    const fn = c.function ?? "?";
    if (c.function === "phonetic") {
      const r = phoneticReading(k, c.glyph);
      return `${c.glyph}[phonetic${r ? `, lends ${r}` : ", lent reading unknown"}]`;
    }
    return `${c.glyph}[${fn}${c.sense ? `: ${c.sense}` : ""}]`;
  });
  if (parts.length) console.log(`  pieces: ${parts.join("  +  ")}`);
  console.log(`  raw: ${e.originText!.trim()}`);
}
