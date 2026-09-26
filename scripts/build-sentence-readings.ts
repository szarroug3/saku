// Generates the KEYS of src/data/generated/sentence-readings.json: every
// Japanese sentence a lesson's "In a sentence" block can show, and every other
// line of Japanese the Sky draws with furigana from the same readings pass.
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
// And, since SAK-484, four more places whose Japanese had no readings at all:
//
//   - the Japanese inside grammar prose: a particle's page (particle-notes.ts),
//     a pattern's pages, a sentence type's walk, and the Family table's
//     patterns and built forms, and since SAK-485 the note under the Family
//     table. Split into runs the way the page splits them
//     (`kanjiRunsIn`), keeping only the runs the vocabulary cannot read as one
//     word (`runsForReadingsPass` in src/app/(sky)/prose-sound.ts): 食べる is
//     read from the vocabulary, 猫は好きです from here;
//   - a verb pair's example sentences (transitivity.ts);
//   - every sentence a sentence-ordering quiz card can deal (assembly.ts),
//     cut into its pieces on the card (`pieceSounds` in src/data/sentence-readings.ts).
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

import { ASSEMBLY } from "../src/data/assembly.ts";
import { sentenceExampleFor, autoPatternPage } from "../src/data/grammar/auto-page.ts";
import { cluster, membersOf } from "../src/data/grammar/clusters.ts";
import { formLibraryPages } from "../src/data/grammar/lessons.ts";
import { PARTICLE_NOTES } from "../src/data/grammar/particle-notes.ts";
import { RECIPES } from "../src/data/grammar/recipes.ts";
import { SENTENCE_ORDERING_GUIDES, type SentenceOrderingTierId } from "../src/data/sentence-ordering-guides.ts";
import { VERB_PAIRS } from "../src/data/transitivity.ts";
import { buildRow } from "../src/lib/grammar/build.ts";
import { lessonsForTier, TIER_EXAMPLES } from "../src/lib/sentence-rule-walk.ts";
import { runsForReadingsPass } from "../src/app/(sky)/prose-sound.ts";

const sentences = new Set<string>();
for (const r of RECIPES) {
  const ex = sentenceExampleFor(r);
  if (ex) sentences.add(ex.jp);
}
for (const guide of Object.values(SENTENCE_ORDERING_GUIDES)) if (guide.example) sentences.add(guide.example.jp);
for (const examples of Object.values(TIER_EXAMPLES)) for (const ex of examples) sentences.add(ex.jp);

// grammar prose, run by run; a run a card has written its own reading for is
// read from the card and not listed here
const prose = (text: string, authored?: Readonly<Record<string, unknown>>) => {
  for (const run of runsForReadingsPass(text)) if (!authored || !Object.hasOwn(authored, run)) sentences.add(run);
};
for (const note of PARTICLE_NOTES) for (const para of note.body) prose(para.text);
for (const r of RECIPES) {
  const intros = formLibraryPages(r.id);
  for (const intro of intros.length ? intros : [autoPatternPage(r)]) {
    for (const para of [...intro.body, ...(intro.bodyAfterBuild ?? [])]) prose(para.text, intro.readings);
  }
  const family = r.cluster ? cluster(r.cluster) : undefined;
  for (const m of family ? membersOf(family) : []) {
    prose(m.pattern);
    if (m.sense) prose(m.sense);
    prose(buildRow(m)?.built ?? "");
  }
  // the note under the Family table (SAK-485): 東京から on 〜から
  if (family && membersOf(family).length > 1 && family.feel) prose(family.feel);
}
for (const [tier, guide] of Object.entries(SENTENCE_ORDERING_GUIDES)) {
  for (const para of guide.body) prose(para.text);
  for (const lesson of lessonsForTier(tier as SentenceOrderingTierId)) for (const text of lesson.details) prose(text);
}
for (const pair of VERB_PAIRS) for (const side of [pair.happens, pair.doIt]) if (side.example) sentences.add(side.example.jp);
for (const item of ASSEMBLY) sentences.add(item.jp);

// Keep the readings already worked out for a sentence still on the list, so
// rerunning this alone does not wipe the Python pass's output.
const path = join(import.meta.dirname, "..", "src", "data", "generated", "sentence-readings.json");
const before: Record<string, unknown> = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
const out: Record<string, unknown> = {};
for (const jp of [...sentences].sort()) out[jp] = before[jp] ?? [];

writeFileSync(path, JSON.stringify(out) + "\n");
console.log(`sentence-readings.json: ${sentences.size} sentences`);
console.log(`  run scripts/ingest/teach_sentence_readings.py next to fill in the per-kanji readings`);
