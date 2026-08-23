// BUILD THE CURRICULUM SEQUENCE INDEX — src/data/generated/curriculum-sequence.json.
//
// WHY. curriculum-order.ts's CURRICULUM_SEQUENCE is a near-linear, pure walk of
// the static curriculum data (every kanji visited once via a `taughtKanji`
// guard, every lookup O(1)) — cheap, but computed at MODULE LOAD, so every
// runtime importer re-runs it: once per Vercel serverless cold start on the
// server chain (server-lookups.ts -> lesson-steps.ts -> spine-intros.ts), and
// once per page load in the client bundle (engine/question.ts is reachable from
// drill-screen.tsx and friends). This serializes the SAME sequence once, here,
// at build time, so runtime code reads it as data instead of recomputing it.
// The same "compute once at build, read as data" pattern word-rank.json already
// uses over word-rank.ts (VOCAB.beginnerRank / CURRICULUM_WORDS membership).
//
// BYTE-CORRECTNESS IS NON-NEGOTIABLE. This script NEVER re-derives — it calls
// curriculum-order.ts's own CURRICULUM_SEQUENCE and serializes exactly what it
// returns, whatever the live ordering algorithm currently does (SAK-161 moved
// WHERE it runs; SAK-162 changed the algorithm itself to one item per taught
// word READING rather than one item per word — see curriculum-order.ts's
// header). curriculum-sequence.equiv.test.ts asserts the precomputed sequence
// is byte-for-byte the live one.
//
// A STANDALONE STEP. This is the only build script curriculum-order.ts feeds:
// it reads no other generated JSON and writes only curriculum-sequence.json, so
// it can run in any order relative to build-learn-index.mjs, build-library-
// index.mjs, build-word-rank.mjs or build-scheduling-preview.mjs without
// colliding with what any of them read or write. (build-learn-index.mjs also
// imports CURRICULUM_SEQUENCE, but straight from curriculum-order.ts's own live
// computation, not from this script's output — the two are independent, not
// sequenced.) Deterministic by construction: buildSequence() sorts every
// queued item on plain numeric/string comparisons over frozen source arrays,
// never Date.now(), Math.random(), or Set/Map iteration order, so re-running
// this script over the same source data always writes the same bytes.
//
// Run with the test harness's loader so Node resolves the app's `@/` alias and
// `.ts` imports:
//   node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-curriculum-sequence.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CURRICULUM_SEQUENCE } from "@/lib/curriculum-order";

const sequence = CURRICULUM_SEQUENCE.map((item) => ({
  glyph: item.glyph,
  roles: [...item.roles],
  tiedTo: item.tiedTo,
  reading: item.reading,
}));

const outPath = fileURLToPath(
  new URL("../src/data/generated/curriculum-sequence.json", import.meta.url),
);
writeFileSync(outPath, JSON.stringify(sequence) + "\n");

console.log(`curriculum-sequence.json written: ${sequence.length} items`);
