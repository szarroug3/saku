// BUILD THE WORD FACTS INDEX — src/data/generated/word-rank.json.
//
// WHY. Two small, structural per-word facts are read by otherwise content-free
// pieces, but each one reaching `vocab.ts`/`word-lesson.ts` pulls the whole
// dictionary in for it:
//   - `beginnerRank` (a word's place in the 1..12,553 teaching order) — keigo.ts
//     sorts its sets by it, the Library's word shelf ranks its tail by it.
//   - CURRICULUM MEMBERSHIP (is this word in the CEJC words-track curriculum,
//     `word-lesson.ts`'s `CURRICULUM_WORDS`) — transitivity-lesson.ts gates a
//     verb pair on both verbs being curriculum words.
// This serializes both, once, at build time. Never re-derives: calls the real
// `VOCAB` rows and the real `CURRICULUM_WORDS` filter, reads their output.
//
// Run with the test harness's loader:
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-word-rank.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { VOCAB } from "@/data/vocab";
import { CURRICULUM_WORDS } from "@/lib/word-lesson";

const rank = {};
for (const w of VOCAB) rank[w.keb] = w.beginnerRank;

const curriculumKebs = CURRICULUM_WORDS.map((w) => w.keb);

const payload = { rank, curriculumKebs };

const outPath = fileURLToPath(
  new URL("../src/data/generated/word-rank.json", import.meta.url),
);
writeFileSync(outPath, JSON.stringify(payload) + "\n");

console.log(
  `word-rank.json written: ${Object.keys(rank).length} words, ` +
    `${curriculumKebs.length} curriculum words`,
);
