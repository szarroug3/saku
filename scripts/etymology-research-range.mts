// Dump kanji that currently show NO etymology story — the recovery targets for
// hand-authoring via research. Two sources: PROSE_SKIP (degenerate Wiktionary
// text, often a shinjitai whose TRADITIONAL form has a known origin) and kanji
// Wiktionary has no record for at all.
//
//   npx tsx scripts/etymology-research-range.mts [START] [COUNT]
//
// No args → prints only the remaining count. Already-authored (MANUAL_ORIGIN)
// and number kanji are excluded, so the list shrinks as batches land.

import { KANJI, KANJI_ORDER, kanjiRow } from "../src/data/kanji.ts";
import { etymologyOf } from "../src/data/kanji-etymology.ts";
import { isNumberKanji } from "../src/data/number-kanji.ts";
import { MANUAL_ORIGIN } from "../src/data/kanji-etymology-prose.ts";
import genJson from "../src/data/generated/kanji-etymology.json" with { type: "json" };
import manJson from "../src/data/generated/kanji-etymology-manual.json" with { type: "json" };

const GEN = (genJson as { data: Record<string, { originText?: string | null; originRaw?: string | null }> }).data;
const MAN = (manJson as { data: Record<string, { originText?: string | null; originRaw?: string | null }> }).data;
// The raw Wiktionary text (pre-suppression) — a research hint. Degenerate ones
// often name the traditional form ("shinjitai of 實"), which is where to look.
const rawHint = (k: string) =>
  MAN[k]?.originText ?? GEN[k]?.originText ?? GEN[k]?.originRaw ?? MAN[k]?.originRaw ?? null;

const meaningOf = (k: string) => kanjiRow(k)?.meanings?.slice(0, 3).join(", ") ?? "";

const seen = new Set<string>();
const seq = [...KANJI_ORDER.map((o) => o.c), ...KANJI.map((k) => k.c)].filter((c) => {
  if (seen.has(c)) return false;
  seen.add(c);
  return true;
});

// Target = no story currently shown, not a number, not already hand-authored.
const targets = seq.filter(
  (k) => !isNumberKanji(k) && !(k in MANUAL_ORIGIN) && !etymologyOf(k)?.originText,
);

console.log(`REMAINING (no story shown, need research): ${targets.length}`);

const START = Number(process.argv[2] ?? -1);
const COUNT = Number(process.argv[3] ?? 0);
if (START < 0) process.exit(0);

for (let i = START; i < START + COUNT && i < targets.length; i++) {
  const k = targets[i];
  const comps = kanjiRow(k)?.comps ?? [];
  console.log(`\n[${i}] ${k}  「${meaningOf(k)}」`);
  if (comps.length) console.log(`  visible pieces: ${comps.join(" ")}`);
  const hint = rawHint(k);
  console.log(`  wiktionary raw (hint, may be degenerate/empty): ${hint ? hint.slice(0, 200) : "(none)"}`);
}
