// Catch the en-synonyms pool drifting away from the app's current content
// (SAK-272) — the CI-check counterpart to scripts/build-en-synonyms.mjs, the
// same relationship scripts/audit-corpus.ts has to scripts/ingest/grammar.py.
//
//     node scripts/audit-en-synonyms.mjs            print the coverage report
//     node scripts/audit-en-synonyms.mjs --check    same, but exit 1 if any
//                                                    needed key was NEVER
//                                                    attempted
//
// WHAT "DRIFT" MEANS HERE, PRECISELY. Every gloss key the app currently needs
// (scripts/lib/en-synonym-keys.mjs's collectSynonymKeys — the exact same
// reduction build-en-synonyms.mjs itself uses, imported not reimplemented, so
// the two can never disagree about what "needed" means) should already have
// been PROCESSED by a prior run of build-en-synonyms.mjs — recorded in the
// committed src/data/generated/en-synonyms-attempted.json ledger — even if
// that processing concluded "no synonym exists" and produced no pool entry.
// A key that is IN en-synonyms.json (has synonyms) or IN the attempted ledger
// (was tried, correctly came up empty — a fox/nonexistent-word/proper-noun
// gloss, say) is NOT drift: that is the pool working as designed, degrading
// gracefully to exact-match-only. A key that is in NEITHER is drift: new
// content added a gloss this pool has never even been asked about, and it is
// silently getting stricter-than-intended grading until someone reruns
// `pnpm run build:en-synonyms`. That is exactly the failure mode SAK-272
// exists to close off.
//
// This script does not touch the network or either generated file — it is a
// pure read-and-compare, so it runs in CI with no Datamuse dependency and no
// risk of ever writing stale data over good data.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { collectSynonymKeys } from "./lib/en-synonym-keys.mjs";

const POOL_PATH = fileURLToPath(
  new URL("../src/data/generated/en-synonyms.json", import.meta.url),
);
const ATTEMPTED_PATH = fileURLToPath(
  new URL("../src/data/generated/en-synonyms-attempted.json", import.meta.url),
);

function readJsonArrayOrObjectKeys(path) {
  const parsed = JSON.parse(readFileSync(path, "utf-8"));
  return Array.isArray(parsed) ? parsed : Object.keys(parsed);
}

function main() {
  const check = process.argv.includes("--check");

  const needed = collectSynonymKeys();
  const pool = new Set(readJsonArrayOrObjectKeys(POOL_PATH));
  const attempted = new Set(readJsonArrayOrObjectKeys(ATTEMPTED_PATH));

  const neverAttempted = needed.filter((k) => !attempted.has(k));
  const withSynonyms = needed.filter((k) => pool.has(k));

  const pct = (n) => ((n / needed.length) * 100).toFixed(1);

  console.log(`en-synonyms coverage: ${needed.length} keys currently needed`);
  console.log(
    `  ${withSynonyms.length} (${pct(withSynonyms.length)}%) have at least one curated synonym`,
  );
  console.log(
    `  ${neverAttempted.length} (${pct(neverAttempted.length)}%) have NEVER been attempted ` +
      `(drift — new content added since the last build:en-synonyms run)`,
  );

  if (neverAttempted.length > 0) {
    const sample = neverAttempted.slice(0, 15);
    console.log(`  sample never-attempted keys: ${sample.join(", ")}`);
  }

  if (check && neverAttempted.length > 0) {
    console.error(
      `\nen-synonyms pool has drifted: ${neverAttempted.length} needed key(s) were never ` +
        `run through scripts/build-en-synonyms.mjs. Run ` +
        `\`pnpm run build:en-synonyms\` and commit the updated ` +
        `src/data/generated/en-synonyms.json + en-synonyms-attempted.json.`,
    );
    process.exit(1);
  }
}

main();
