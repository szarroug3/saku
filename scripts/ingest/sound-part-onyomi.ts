// The on'yomi of the pieces a kanji's origin names for its sound, for the
// pieces the kanji table has no on'yomi for (SAK-486).
//
// SOURCE (fetched, not committed, the same policy as the other ingests):
//   kanjidic2.xml.gz   KANJIDIC2, CC BY-SA 4.0, Electronic Dictionary Research
//                      and Development Group, https://www.edrdg.org/kanjidic/
//                      Pinned in src/data/generated/sources.json as
//                      "kanjidic2-sound-parts" and downloaded to the ignored
//                      scripts/ingest/raw directory on the first run.
//
// Its own pin, not the "kanjidic2" one build.py and the others read: EDRDG
// publishes a new KANJIDIC2 every day and keeps no old ones, so the file those
// passes were cut from cannot be downloaded again. Accepting today's file under
// that id would leave kanji.json, readings.json and radicals.json claiming bytes
// they were not built from until all three passes are re-run, which is more
// than this table needs.
//
// OUTPUT (committed):
//   src/data/generated/sound-part-onyomi.json   { "<piece>": ["<on'yomi>", ...] }
//   on'yomi in hiragana, in KANJIDIC2's order. Only the pieces an origin names
//   for its sound (src/data/sound-part-onyomi.ts's SOUND_OF) that the kanji
//   table has no on'yomi for, and only those KANJIDIC2 gives one for. The rest
//   are printed on the console, since they stay plain on the card.
//
// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/ingest/sound-part-onyomi.ts
//   add --accept-source to record a newer KANJIDIC2

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { KANJI, kanjiRow } from "../../src/data/kanji.ts";
import { etymologyOf } from "../../src/data/kanji-etymology.ts";
import { SOUND_OF } from "../../src/data/sound-part-onyomi.ts";
import { acceptSource, ensureArchive, readArchiveText, recordBuild, REPO, verifySource } from "./sources.mjs";

const ID = "kanjidic2-sound-parts";
const OUT = "sound-part-onyomi.json";

/** The pieces the origin prose names for their sound that the kanji table
 * gives no on'yomi for, each with the kanji that name it. */
function namedPieces(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const { c } of KANJI) {
    const text = etymologyOf(c)?.originText;
    if (!text) continue;
    for (const m of text.matchAll(SOUND_OF)) {
      const piece = m[1];
      if (kanjiRow(piece)?.on.length) continue;
      const hosts = out.get(piece) ?? [];
      if (!hosts.includes(c)) hosts.push(c);
      out.set(piece, hosts);
    }
  }
  return out;
}

const hiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

/** Every literal's on'yomi, in hiragana and in the order KANJIDIC2 lists
 * them. A reading's marks (the "-" some carry) are dropped. */
function onyomiOf(xml: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const block of xml.split("<character>").slice(1)) {
    const literal = block.match(/<literal>(.*?)<\/literal>/)?.[1];
    if (!literal) continue;
    const ons: string[] = [];
    for (const r of block.matchAll(/<reading r_type="ja_on"[^>]*>(.*?)<\/reading>/g)) {
      const on = hiragana(r[1]).replace(/[^ぁ-ゖー]/g, "");
      if (on && !ons.includes(on)) ons.push(on);
    }
    if (ons.length) out.set(literal, ons);
  }
  return out;
}

async function main() {
  await ensureArchive(ID);
  const xml = readArchiveText(ID);
  const version = xml.match(/<database_version>(.*?)<\/database_version>/)?.[1] ?? null;
  verifySource(ID, { accept: acceptSource(), version });

  const pieces = namedPieces();
  const ons = onyomiOf(xml);
  const table: Record<string, string[]> = {};
  const plain: string[] = [];
  for (const piece of [...pieces.keys()].sort()) {
    const found = ons.get(piece);
    if (found) table[piece] = found;
    else plain.push(piece);
  }

  writeFileSync(join(REPO, "src", "data", "generated", OUT), JSON.stringify(table, null, 1) + "\n");
  recordBuild("scripts/ingest/sound-part-onyomi.ts", [OUT], [ID]);

  console.log(`pieces named for their sound with no on'yomi in the kanji table: ${pieces.size}`);
  console.log(`given an on'yomi from KANJIDIC2 ${version}: ${Object.keys(table).length}`);
  console.log(`still plain, KANJIDIC2 has no on'yomi for them: ${plain.length}`);
  for (const piece of plain) console.log(`  ${piece}  in ${pieces.get(piece)?.join("")}`);
}

await main();
