// Ingest the Kanjium pitch-accent database into a lean per-word lookup.
//
// WHAT THIS PRODUCES
// ==================
// src/data/generated/pitch.json — a flat object keyed by a word's WRITTEN form
// (keb), each value a single integer: the mora position of the downstep.
//   0  heiban   — no downstep, stays high after the first mora (箸→端 はし 0)
//   1  atamadaka — high on mora 1, drops after it (箸 はし 1)
//   n  odaka/nakadaka — high through mora n, drops after (橋 はし 2, 先生 3)
// The renderer (src/lib/pitch.ts + src/components/library/pitch-mark.tsx) turns
// that one number into the standard overline notation. Nothing else is stored:
// the reading it applies to already lives on the vocab row.
//
// WHY KANJIUM, AND WHY ONLY THE CLEAN ROWS
// ========================================
// Kanjium (github.com/mifunetoshiro/kanjium, data/source_files/raw/accents.txt)
// is the pitch database Yomichan and Migaku ship, derived from the NHK 日本語発音
// アクセント辞典 and 大辞林. It is CC BY-SA 4.0 — the same licence this project
// carries — so it can be redistributed as a derivative under src/data/generated.
// Attribution is recorded in src/data/generated/LICENSE / the app's NOTICE.
//
// A WRONG downstep taught as fact is worse than no pitch at all, so this ingest
// is deliberately conservative. Each raw line is `word<TAB>reading<TAB>accent`.
// A row contributes a pitch ONLY when ALL of these hold:
//   - the accent field is a SINGLE integer. ~17k rows carry comma-separated
//     alternatives (じゅうがつ「4,0」) or parenthesised part-of-speech splits
//     (「(副)0,(名)3」). Those words genuinely have more than one accepted
//     accent, so the honest thing is to store none rather than pick one.
//   - the (word, reading) pair matches a vocab row on BOTH keb AND reb. Keying
//     on the written form alone would give 箸 the accent of 橋; keying on the
//     reading alone would give はし three different answers. Homographs差 are
//     only safe when both agree.
//   - the pair is unambiguous within Kanjium itself — no two rows disagree.
//
// Anything that fails a check is dropped, counted, and reported. Partial and
// certain beats complete and guessed.
//
// RUN
// ===
//   node scripts/ingest/pitch.mjs
// Fetches accents.txt from the Kanjium master branch (raw.githubusercontent.com,
// the same host scripts/ingest/kanjivg.mjs uses) and writes the JSON. Network
// access required; it is one file, so it is quick.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const GENDIR = resolve(REPO, "src/data/generated");

const ACCENTS_URL =
  "https://raw.githubusercontent.com/mifunetoshiro/kanjium/master/data/source_files/raw/accents.txt";

/** Parse the raw accent file into a (word\treading) → downstep map, keeping only
 * rows whose accent is a single clean integer and that no other row disagrees
 * with. Ambiguous keys are removed entirely rather than resolved. */
function parseAccents(text) {
  const seen = new Map(); // key -> Set<string> of raw accent strings
  for (const line of text.split("\n")) {
    if (!line) continue;
    const [word, reading, accent] = line.split("\t");
    if (word === undefined || reading === undefined || accent === undefined) {
      continue;
    }
    const key = `${word}\t${reading}`;
    let set = seen.get(key);
    if (!set) seen.set(key, (set = new Set()));
    set.add(accent);
  }

  const clean = new Map(); // key -> number
  const stats = { ambiguous: 0, multiValue: 0 };
  for (const [key, set] of seen) {
    if (set.size > 1) {
      stats.ambiguous++; // two rows disagree about the same word+reading
      continue;
    }
    const accent = [...set][0];
    if (!/^\d+$/.test(accent)) {
      stats.multiValue++; // comma alternatives or (POS)-qualified splits
      continue;
    }
    clean.set(key, Number.parseInt(accent, 10));
  }
  return { clean, stats };
}

async function main() {
  process.stderr.write(`Fetching ${ACCENTS_URL}\n`);
  const res = await fetch(ACCENTS_URL);
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();

  const { clean, stats } = parseAccents(text);

  const vocab = JSON.parse(
    await readFile(resolve(GENDIR, "vocab.json"), "utf8"),
  );

  // Match on BOTH written form and reading. keb is unique across vocab, so the
  // output can be keyed by keb alone once the reb has been checked.
  const out = {};
  let matched = 0;
  let hitButDropped = 0;
  for (const row of vocab) {
    const key = `${row.keb}\t${row.reb}`;
    if (clean.has(key)) {
      out[row.keb] = clean.get(key);
      matched++;
    } else if (
      // The pair exists in Kanjium but only as an ambiguous / multi-value row.
      text.includes(`${row.keb}\t${row.reb}\t`)
    ) {
      hitButDropped++;
    }
  }

  // Stable key order so the diff is legible and re-runs are reproducible.
  const sorted = {};
  for (const keb of Object.keys(out).sort()) sorted[keb] = out[keb];

  const path = resolve(GENDIR, "pitch.json");
  await writeFile(path, `${JSON.stringify(sorted)}\n`);

  const pct = ((100 * matched) / vocab.length).toFixed(1);
  process.stderr.write(
    [
      `Kanjium clean (word,reading) keys: ${clean.size}`,
      `  dropped ambiguous keys: ${stats.ambiguous}`,
      `  dropped multi-value keys: ${stats.multiValue}`,
      `Vocab words: ${vocab.length}`,
      `  with verified pitch: ${matched} (${pct}%)`,
      `  present but ambiguous, no pitch stored: ${hitButDropped}`,
      `Wrote ${path}`,
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
