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
// BYTE-CORRECTNESS IS NON-NEGOTIABLE. This is a pure refactor (SAK-161): the
// ordering algorithm itself does not change here (that is SAK-162, blocked on
// this ticket). So this script NEVER re-derives — it calls curriculum-order.ts's
// own CURRICULUM_SEQUENCE and serializes exactly what it returns.
// curriculum-sequence.equiv.test.ts asserts the precomputed sequence is
// byte-for-byte the live one.
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
}));

const outPath = fileURLToPath(
  new URL("../src/data/generated/curriculum-sequence.json", import.meta.url),
);
writeFileSync(outPath, JSON.stringify(sequence) + "\n");

console.log(`curriculum-sequence.json written: ${sequence.length} items`);
