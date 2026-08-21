// Build the homophone-pair table pitch quiz questions draw from (SAK-128).
//
// WHAT THIS PRODUCES
// ===================
// src/data/generated/pitch-pairs.json — a flat array of
// [kebA, kebB, reading] triples: two DIFFERENT vocabulary words that are read
// exactly the same way but carry different verified pitch (箸/橋 both はし,
// one atamadaka one odaka). src/data/pitch-pairs.ts turns this into a
// keb → partner lookup; src/lib/pitch-quiz.ts is the one place that reads it
// to pick a pitch quiz question's PREFERRED mode ("pair") over the
// synthetic-wrong fallback.
//
// WHY THIS EXISTS SEPARATELY FROM pitch.mjs
// ==========================================
// pitch.mjs already answers "what is this word's downstep"; this answers a
// different question — "does the curriculum contain a genuine minimal pair
// for this word's reading" — which needs the WHOLE vocabulary grouped by
// reading, not a per-word lookup. Built at ingest time, like pitch.json
// itself, rather than scanning all 12,553 words on every quiz card.
//
// THE RULE: only real curriculum words, both with VERIFIED pitch, at
// DIFFERENT downsteps
// ====================================================================
// A pair is only as good as its data. Two words are paired only when:
//   - they share the TAUGHT reading (mirrors pitch.mjs's own `taughtReading`
//     — the reading a word is actually taught with, which for a handful of
//     words differs from vocab.json's raw `reb`);
//   - BOTH already carry a verified downstep in pitch.json (never guessed —
//     same discipline pitch.mjs documents);
//   - their downsteps DIFFER. Two words that happen to share a reading AND a
//     pitch pattern are not a pitch-accent minimal pair — a learner could not
//     tell them apart by ear even with perfect pitch, so quizzing "which one
//     did you hear" would have no honest answer.
//
// A reading with three or more qualifying words (箸/橋/端, all はし) yields
// every pairwise combination whose downsteps differ, not just one — a quiz
// asking about 端 should be able to pair it with EITHER 箸 or 橋, not just
// whichever came first.
//
// RUN
// ===
//   node scripts/ingest/pitch-pairs.mjs
// Reads the already-generated vocab.json, word-senses.json and pitch.json —
// run scripts/ingest/pitch.mjs first if pitch.json is stale. No network
// access; pure local computation.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const GENDIR = resolve(REPO, "src/data/generated");

/** The reading a word is TAUGHT with — mirrors pitch.mjs's own helper of the
 * same name exactly, so a pair's reading always matches what the pitch mark
 * and the "Hear it" button render for that word. See pitch.mjs's comment on
 * why this can differ from vocab.json's raw `reb` (面 ships as おもて but is
 * taught めん). */
function taughtReading(row, senses) {
  const s = senses[row.keb];
  return s && s.length ? s[0].reb : row.reb;
}

async function main() {
  const vocab = JSON.parse(await readFile(resolve(GENDIR, "vocab.json"), "utf8"));
  const senses = JSON.parse(
    await readFile(resolve(GENDIR, "word-senses.json"), "utf8"),
  );
  const pitch = JSON.parse(await readFile(resolve(GENDIR, "pitch.json"), "utf8"));

  // Group every word that has a VERIFIED pitch by its taught reading.
  const byReading = new Map(); // reading -> [{ keb, downstep }]
  for (const row of vocab) {
    const downstep = pitch[row.keb];
    if (downstep === undefined) continue; // no verified pitch, never guess
    const reading = taughtReading(row, senses);
    let group = byReading.get(reading);
    if (!group) byReading.set(reading, (group = []));
    group.push({ keb: row.keb, downstep });
  }

  const pairs = [];
  let readingsWithGroup = 0;
  for (const [reading, group] of byReading) {
    if (group.length < 2) continue;
    readingsWithGroup++;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].downstep === group[j].downstep) continue; // not a minimal pair
        // Stable, alphabetic order so the output (and any diff) is reproducible
        // regardless of vocab.json's row order.
        const [a, b] =
          group[i].keb <= group[j].keb
            ? [group[i].keb, group[j].keb]
            : [group[j].keb, group[i].keb];
        pairs.push([a, b, reading]);
      }
    }
  }

  pairs.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : 1));

  const path = resolve(GENDIR, "pitch-pairs.json");
  await writeFile(path, `${JSON.stringify(pairs)}\n`);

  const wordsCovered = new Set(pairs.flatMap((p) => [p[0], p[1]])).size;
  process.stderr.write(
    [
      `Readings shared by 2+ verified-pitch words: ${readingsWithGroup}`,
      `Homophone pitch pairs (differing downstep): ${pairs.length}`,
      `Words covered by at least one pair: ${wordsCovered}`,
      `Wrote ${path}`,
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
