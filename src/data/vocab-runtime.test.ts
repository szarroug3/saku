// The shipped runtime vocabulary is exactly what the builder produces from
// the source tables (SAK-399): a change to any of them without rerunning
// `npm run build:vocab-runtime` fails here, so vocab.ts can never read a
// stale file.

import assert from "node:assert/strict";
import { test } from "node:test";

import vocabRuntimeJson from "./generated/vocab-runtime.json" with { type: "json" };
import { buildVocabRuntime } from "./vocab-build.ts";

test("vocab-runtime.json is what the builder produces from the source tables", () => {
  const built = JSON.parse(JSON.stringify(buildVocabRuntime()));
  assert.deepEqual(built, vocabRuntimeJson);
});
