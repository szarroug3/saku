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
//   - the (word, reading) pair matches a vocab row on BOTH keb AND the reading
//     the word is TAUGHT with (word-senses.json's primary sense reb, which can
//     differ from vocab.json's raw reb — 面 ships as おもて but is taught めん;
//     人 ships as じん but is taught ひと). Keying on the written form alone
//     would give 箸 the accent of 橋; keying on the reading alone would give
//     はし three different answers; keying on vocab.json's raw reb instead of
//     the taught reading fetched the WRONG reading's pitch for any word whose
//     primary sense differs from it (SAK-221). Homographs are only safe when
//     both keb and the taught reading agree.
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

/** Count the morae of a kana reading. A mora is one beat of the language, and
 * kana map to it ALMOST one-to-one — the exceptions are the small y-glides that
 * form a yōon (きゃ, しゅ, ちょ) and the small vowels that form foreign yōon
 * (ファ, ウィ): those ride the preceding full kana and add no beat. Everything
 * else is its own mora, INCLUDING the three that look like they might not be —
 * the long-vowel mark ー (コーヒー = ko-o-hi-i, 4), the small っ sokuon
 * (がっこう = ga-t-ko-o, 4), and ん (せんせい = se-n-se-e, 4). This is the count a
 * downstep is measured against: an accent may fall on morae 0..moraCount, so any
 * stored downstep larger than this is impossible for the reading. */
const SMALL_KANA = new Set("ゃゅょャュョぁぃぅぇぉァィゥェォ");
function moraCount(reading) {
  let n = 0;
  for (const c of reading) {
    if (SMALL_KANA.has(c)) continue;
    n++;
  }
  return n;
}

/** The reading a word is TAUGHT with, mirroring src/data/vocab.ts's withSenses:
 * when word-senses.json lists a form, its FIRST sense's reading is the primary
 * (面 ships in vocab.json as おもて but is taught as めん). The pitch mark is
 * rendered on this reading, so this — not the raw vocab.json reb the Kanjium
 * match was keyed on — is what a downstep must be valid against. */
function taughtReading(row, senses) {
  const s = senses[row.keb];
  return s && s.length ? s[0].reb : row.reb;
}

// SAK-221 REGRESSION SAMPLE. Words the audit confirmed the buggy vocab.json-reb
// lookup got wrong (or, for 仏/悪口, wrong in the other direction — it stored a
// value where Kanjium is ambiguous and the honest answer is none). Checked
// after every re-ingest, straight against that run's freshly fetched Kanjium
// text, by a codepath that does NOT reuse parseAccents/the matching loop above
// — so a future change that reintroduces "look up by row.reb instead of the
// taught reading" (or any other break in this same spot) fails the ingest
// instead of shipping quietly.
const REGRESSION_SAMPLE = [
  ["人", "ひと"],
  ["入る", "はいる"],
  ["開く", "あく"],
  ["下手", "へた"],
  ["空", "そら"],
  ["上下", "じょうげ"],
  ["印", "しるし"],
  ["節", "ふし"],
  ["仏", "ほとけ"], // ambiguous in Kanjium ("0,3") — must resolve to no value
  ["悪口", "あっこう"], // ambiguous in Kanjium ("0,3") — must resolve to no value
];

/** Re-derive the correct downstep for one (keb, reading) pair directly from
 * the raw Kanjium text, independently of parseAccents()/the `clean` map: scan
 * every line for that exact tab-separated prefix, and only return a value
 * when every matching line agrees on a single bare-integer accent. Returns
 * undefined when there is no matching row, the rows disagree, or the shared
 * accent is a comma/parenthesis alternative — matching the ingest's own
 * "ambiguous means no pitch" rule via a separate implementation. */
function independentLookup(rawText, keb, reading) {
  const prefix = `${keb}\t${reading}\t`;
  const accents = new Set();
  for (const line of rawText.split("\n")) {
    if (line.startsWith(prefix)) accents.add(line.slice(prefix.length));
  }
  if (accents.size !== 1) return undefined;
  const [accent] = accents;
  return /^\d+$/.test(accent) ? Number.parseInt(accent, 10) : undefined;
}

/** Check REGRESSION_SAMPLE against this run's output. Returns a list of
 * human-readable failure strings (empty when everything matches). */
function verifyRegressionSample(rawText, vocab, senses, out) {
  const failures = [];
  for (const [keb, expectedReading] of REGRESSION_SAMPLE) {
    const row = vocab.find((r) => r.keb === keb);
    if (!row) {
      failures.push(`${keb}: no longer in vocab.json — update the regression sample`);
      continue;
    }
    const reading = taughtReading(row, senses);
    if (reading !== expectedReading) {
      failures.push(
        `${keb}: taught reading is now ${reading}, sample expects ${expectedReading} — update the regression sample`,
      );
      continue;
    }
    const expected = independentLookup(rawText, keb, reading);
    const actual = out[keb];
    if (actual !== expected) {
      failures.push(
        `${keb} (${reading}): pitch.json has ${actual === undefined ? "no value" : actual}, ` +
          `independently re-derived from Kanjium: ${expected === undefined ? "no value" : expected}`,
      );
    }
  }
  return failures;
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
  const senses = JSON.parse(
    await readFile(resolve(GENDIR, "word-senses.json"), "utf8"),
  );

  // Match on BOTH written form and the TAUGHT reading. keb is unique across
  // vocab, so the output can be keyed by keb alone once the reading has been
  // checked. Looking up by vocab.json's raw reb here (rather than the taught
  // reading) was the SAK-221 bug: for a word whose primary sense reads
  // differently from vocab.json's reb (面 ships as おもて but is taught めん;
  // 人 ships as じん but is taught ひと), that mismatch fetched Kanjium's
  // pitch for the WRONG reading and shipped it as if it were correct.
  const out = {};
  let matched = 0;
  let hitButDropped = 0;
  const outOfRange = []; // dropped: downstep past the taught reading's last mora
  for (const row of vocab) {
    const reading = taughtReading(row, senses);
    const key = `${row.keb}\t${reading}`;
    if (clean.has(key)) {
      const downstep = clean.get(key);
      // VALIDITY INVARIANT. An accent falls on some mora 0..moraCount; a downstep
      // larger than the reading's mora count is impossible and renders a drop past
      // the end of the word. This catches a wrong Kanjium row.
      if (downstep > moraCount(reading)) {
        outOfRange.push(
          `${row.keb} (taught ${reading}, ${moraCount(reading)} morae) ` +
            `downstep ${downstep}`,
        );
        continue;
      }
      out[row.keb] = downstep;
      matched++;
    } else if (
      // The pair exists in Kanjium but only as an ambiguous / multi-value row.
      text.includes(`${row.keb}\t${reading}\t`)
    ) {
      hitButDropped++;
    }
  }

  // SAK-221 regression guard: verify the sample BEFORE writing anything, so a
  // reintroduced bug fails the ingest instead of shipping a bad pitch.json.
  const regressionFailures = verifyRegressionSample(text, vocab, senses, out);
  if (regressionFailures.length) {
    throw new Error(
      `SAK-221 regression check failed against freshly fetched Kanjium data:\n${regressionFailures
        .map((f) => `  - ${f}`)
        .join("\n")}`,
    );
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
      `  dropped, downstep past taught reading: ${outOfRange.length}`,
      ...outOfRange.map((s) => `    ${s}`),
      `SAK-221 regression sample: ${REGRESSION_SAMPLE.length}/${REGRESSION_SAMPLE.length} match Kanjium`,
      `Wrote ${path}`,
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
