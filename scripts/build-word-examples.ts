// Generates src/data/generated/word-examples.json: one Tatoeba sentence per
// vocabulary word that has one.
//
// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-word-examples.ts
//
// This is a DERIVED artifact, built from two files that are themselves
// generated (grammar-corpus.json and vocab.json), not from an upstream dump. It
// exists so the Library entry page can show a word in a real sentence without
// importing the 1.8 MB corpus into its client bundle; the reasoning is in
// src/lib/library/word-example.ts, which owns the choosing.
//
// Rerun it whenever the corpus or the vocabulary is rebuilt. The output is
// deterministic — same inputs, same file, byte for byte — so a rerun that
// changes nothing produces no diff.
//
// LICENCE: the sentences are Tatoeba, CC BY 2.0 FR, and every row keeps its
// Tatoeba id so the sentence on screen is traceable to the human who wrote it.
// See src/data/attribution.ts.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { CORPUS } from "../src/data/grammar/corpus.ts";
import { VOCAB } from "../src/data/vocab.ts";
import { chooseExample, indexByWord } from "../src/lib/library/word-example.ts";

const rank = new Map(VOCAB.map((w) => [w.keb, w.beginnerRank]));
const rankOf = (lemma: string) => rank.get(lemma);

const byWord = indexByWord(CORPUS);

// Sorted by written form so the file's key order is stable across runs.
const out: Record<string, [number, string, string]> = {};
let n = 0;
for (const w of [...VOCAB].sort((a, b) => (a.keb < b.keb ? -1 : a.keb > b.keb ? 1 : 0))) {
  const candidates = byWord.get(w.keb);
  if (!candidates) continue;
  const pick = chooseExample(candidates, w.keb, rankOf);
  if (!pick) continue;
  out[w.keb] = [pick.id, pick.jp, pick.en];
  n++;
}

const path = join(import.meta.dirname, "..", "src", "data", "generated", "word-examples.json");
writeFileSync(path, JSON.stringify(out) + "\n");
console.log(`word-examples.json: ${n} of ${VOCAB.length} words (${((100 * n) / VOCAB.length).toFixed(1)}%)`);
