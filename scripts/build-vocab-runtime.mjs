// BUILD THE RUNTIME VOCABULARY, src/data/generated/vocab-runtime.json: the
// finished VocabRows, the teaching metadata, the reading counts and the legacy
// readings, so vocab.ts parses one file at load instead of building 12,555
// rows from three tables on every cold start (SAK-399).
//
//   npm run build:vocab-runtime
//
// Run after any change to vocab.json, cejc-reading-frequency.json,
// word-senses.json, word-definitions.json, number-word-alternates.json, or
// vocab-build.ts. src/data/vocab-runtime.test.ts fails until it is rerun.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildVocabRuntime } from "../src/data/vocab-build.ts";

const runtime = buildVocabRuntime();
const outPath = fileURLToPath(new URL("../src/data/generated/vocab-runtime.json", import.meta.url));
const text = JSON.stringify(runtime);
writeFileSync(outPath, text + "\n");
console.log(`vocab-runtime.json: ${runtime.rows.length} rows, ${Object.keys(runtime.posFamilies).length} words with a part-of-speech family, ${(text.length / 1048576).toFixed(2)} MB`);
