// Dump the "partial" kanji — those whose Built-from shows SOME tiles but drops a
// visible piece the join couldn't label — with everything needed to judge whether
// the dropped piece is recoverable.
//
//   npx tsx scripts/reassembly-range.mts [START] [COUNT]
//
// No args → count only. Already-handled kanji (in BUILT_PIECES_OVERRIDE) are
// excluded so the list shrinks as batches land.

import { KANJI, kanjiRow, READINGS } from "../src/data/kanji.ts";
import { etymologyOf, builtFromRoles, builtPieces } from "../src/data/kanji-etymology.ts";
import { isNumberKanji } from "../src/data/number-kanji.ts";

const meaningOf = (k: string) => kanjiRow(k)?.meanings?.slice(0, 3).join(", ") ?? "";
const onOf = (k: string) =>
  READINGS.filter((r) => r.k === k && (r.type === "on" || r.type === "both")).map((r) => r.base);

// A partial: ≥1 labelled tile AND ≥1 dropped visible piece. We treat a kanji as
// "already handled" if builtPieces has no dropped piece left (an override filled
// it) — cheap and correct enough for slicing.
const partials = KANJI.map((r) => r.c).filter((k) => {
  if (isNumberKanji(k)) return false;
  const comps = kanjiRow(k)?.comps ?? [];
  if (comps.length < 2) return false;
  const roles = builtFromRoles(k);
  const labelled = roles.filter((r) => r).length;
  const dropped = roles.filter((r) => !r).length;
  if (!(labelled >= 1 && dropped >= 1)) return false;
  // If an override already supplies a full tile set (no dropped piece), skip.
  return builtPieces(k).length <= labelled;
});

console.log(`PARTIALS remaining: ${partials.length}`);

const START = Number(process.argv[2] ?? -1);
const COUNT = Number(process.argv[3] ?? 0);
if (START < 0) process.exit(0);

for (let i = START; i < START + COUNT && i < partials.length; i++) {
  const k = partials[i];
  const comps = kanjiRow(k)?.comps ?? [];
  const roles = builtFromRoles(k);
  const e = etymologyOf(k);
  const matched = new Set(roles.filter((r) => r).map((r) => r!.matched));
  const unmatched = (e?.components ?? []).filter((c) => c.function && !matched.has(c.glyph));
  console.log(`\n[${i}] ${k}  「${meaningOf(k)}」  on-readings: ${onOf(k).join("/") || "—"}`);
  console.log(
    `  visible pieces: ${comps
      .map((c, j) => (roles[j] ? `${c}[${roles[j]!.function}: shown]` : `${c}[DROPPED]`))
      .join("  ")}`,
  );
  console.log(
    `  wiktionary unmatched component(s): ${unmatched
      .map((c) => `${c.glyph}[${c.function}${c.sense ? ": " + c.sense : ""}]`)
      .join(", ") || "(none)"}`,
  );
  console.log(`  story: ${(e?.originText ?? "").slice(0, 160)}`);
}
