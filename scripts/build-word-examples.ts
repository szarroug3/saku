// Generates src/data/generated/word-examples.json: one Tatoeba sentence per
// vocabulary word that has one.
//
// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-word-examples.ts
//
// This is a DERIVED artifact, built from three files that are themselves
// generated (grammar-corpus.json, vocab.json and word-example-candidates.json),
// not from an upstream dump. It exists so the Library entry page can show a
// word in a real sentence without importing the 1.8 MB corpus into its client
// bundle; the reasoning is in src/lib/library/word-example.ts, which owns the
// choosing.
//
// TWO POOLS, AND THE FIRST ONE WINS (SAK-461)
// ===========================================
// The corpus pool is grammar-corpus.json's sentences for this word plus
// word-example.ts's EXTRA_EXAMPLES, a small, hand-verified supplement of real
// Tatoeba sentences for the rare word whose only corpus candidate teaches the
// wrong sense. See EXTRA_EXAMPLES's own doc comment for what makes a row
// eligible.
//
// The corpus is filtered to grammar-pattern matches, not "every Tatoeba
// sentence", and that filter left 9,566 of the 12,555 words with no sentence at
// all, set phrases like いただきます among them. So a SECOND pool,
// word-example-candidates.json, is cut from the whole pinned jpn-eng export by
// scripts/ingest/word_example_candidates.py, and is used only where the corpus
// pool is empty. The loop below says why in full: the corpus's picks and its
// refusals both stand, so the 2,989 rows that existed before cannot move.
//
// Rerun it whenever the corpus or the vocabulary is rebuilt. The output is
// deterministic — same inputs, same file, byte for byte — so a rerun that
// changes nothing produces no diff.
//
// LICENSE: the sentences are Tatoeba, CC BY 2.0 FR, and every row keeps its
// Tatoeba id so the sentence on screen is traceable to the human who wrote it.
// See src/data/attribution.ts.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import candidatesJson from "../src/data/generated/word-example-candidates.json" with { type: "json" };
import { corpus } from "../src/data/grammar/corpus.ts";
import { VOCAB } from "../src/data/vocab.ts";
import type { CandidateFile } from "../src/lib/library/word-example.ts";
import {
  EXTRA_EXAMPLES,
  candidatesByWord,
  chooseExample,
  indexByWord,
} from "../src/lib/library/word-example.ts";

const rank = new Map(VOCAB.map((w) => [w.keb, w.beginnerRank]));
const rankOf = (lemma: string) => rank.get(lemma);

const byWord = indexByWord(corpus());
const wider = candidatesByWord(candidatesJson as unknown as CandidateFile);

// Sorted by written form so the file's key order is stable across runs.
//
// Six-element rows, fixed shape: [id, jp, en, start, end, kr]. start/end are
// ALWAYS null here (SAK-97) — the highlight span needs real tokenization to
// find a word's CONJUGATED surface form (思う shown as 思った), not just its
// literal spelling, so it is computed in scripts/ingest/sentence_readings.py,
// the same pass that already tokenizes every sentence with fugashi for the
// `kr` per-kanji-reading field. One tokenization, both outputs. kr is always
// [] here — sentence_readings.py is a SECOND pass that reads this same file
// back and fills both start/end and kr in. One row shape both passes agree
// on, so neither can silently drop what the other wrote.
const out: Record<
  string,
  [number, string, string, number | null, number | null, unknown[]]
> = {};
let n = 0;
let fromCorpus = 0;
for (const w of [...VOCAB].sort((a, b) => (a.keb < b.keb ? -1 : a.keb > b.keb ? 1 : 0))) {
  const candidates = [...(byWord.get(w.keb) ?? []), ...(EXTRA_EXAMPLES[w.keb] ?? [])];
  // THE CORPUS POOL FIRST, AND ITS ANSWER IS FINAL (SAK-461). A word the
  // corpus reaches keeps the sentence it already had, so none of the rows this
  // file held before the wider pool existed can move. And a word whose every
  // corpus candidate is banned by WRONG_SENSE_EXAMPLES keeps its REFUSAL: that
  // ban is a human judgment that no sentence is better than that one, and
  // reaching past it into a wider pool would quietly undo it. Only a word with
  // no corpus candidate at all falls through.
  const pick =
    candidates.length > 0
      ? chooseExample(candidates, w.keb, rankOf)
      : chooseExample(wider.get(w.keb) ?? [], w.keb, rankOf);
  if (!pick) continue;
  if (candidates.length > 0) fromCorpus++;
  out[w.keb] = [pick.id, pick.jp, pick.en, null, null, []];
  n++;
}

const path = join(import.meta.dirname, "..", "src", "data", "generated", "word-examples.json");
writeFileSync(path, JSON.stringify(out) + "\n");
console.log(`word-examples.json: ${n} of ${VOCAB.length} words (${((100 * n) / VOCAB.length).toFixed(1)}%)`);
console.log(`  ${fromCorpus} from the grammar corpus, ${n - fromCorpus} from the wider Tatoeba pool`);
console.log(`  run scripts/ingest/sentence_readings.py next to fill in the highlight span and per-kanji readings (kr)`);
