// Generates the KEYS of src/data/generated/sentence-readings.json: every
// Japanese sentence a lesson's "In a sentence" block can show.
//
// Run, then run the readings pass over what it wrote:
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-sentence-readings.ts
//   uv run --with fugashi --with unidic-lite scripts/ingest/teach_sentence_readings.py
//
// The block (Example in src/sky/components/teach-page.tsx) shows three kinds of
// sentence, and this lists all three from the same code that picks them:
//
//   - a pattern page's worked sentence, sentenceExampleFor() in auto-page.ts,
//     which is a corpus row or one of authored.ts's hand-picked rows;
//   - a sentence type's intro example, SENTENCE_ORDERING_GUIDES[tier].example;
//   - a sentence type's step examples, TIER_EXAMPLES.
//
// Two passes for the same reason word-examples.json has two
// (build-word-examples.ts, then sentence_readings.py): choosing the sentence is
// TypeScript, and reading it needs fugashi, which is Python. This pass writes
// each sentence with an empty slot list; the Python pass fills the slots in
// with the per-kanji readings. teach.test.ts checks every sentence the block can
// show has a row here, so a sentence added without rerunning both is caught.
//
// Sorted, so a rerun that changes nothing produces no diff.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { sentenceExampleFor } from "../src/data/grammar/auto-page.ts";
import { RECIPES } from "../src/data/grammar/recipes.ts";
import { SENTENCE_ORDERING_GUIDES } from "../src/data/sentence-ordering-guides.ts";
import { TIER_EXAMPLES } from "../src/lib/sentence-rule-walk.ts";

const sentences = new Set<string>();
for (const r of RECIPES) {
  const ex = sentenceExampleFor(r);
  if (ex) sentences.add(ex.jp);
}
for (const guide of Object.values(SENTENCE_ORDERING_GUIDES)) if (guide.example) sentences.add(guide.example.jp);
for (const examples of Object.values(TIER_EXAMPLES)) for (const ex of examples) sentences.add(ex.jp);

// Keep the readings already worked out for a sentence still on the list, so
// rerunning this alone does not wipe the Python pass's output.
const path = join(import.meta.dirname, "..", "src", "data", "generated", "sentence-readings.json");
const before: Record<string, unknown> = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
const out: Record<string, unknown> = {};
for (const jp of [...sentences].sort()) out[jp] = before[jp] ?? [];

writeFileSync(path, JSON.stringify(out) + "\n");
console.log(`sentence-readings.json: ${sentences.size} sentences`);
console.log(`  run scripts/ingest/teach_sentence_readings.py next to fill in the per-kanji readings`);
