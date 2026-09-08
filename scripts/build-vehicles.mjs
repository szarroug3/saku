// BUILD THE GRAMMAR VEHICLES, src/data/generated/vehicles.json: the verb pool
// and the two pinned vehicles, so vehicles.ts reads 21 KB at load instead of
// filtering, sorting and slicing all 12,555 VOCAB rows once per regular
// conjugation class and asking the dictionary for each candidate's register
// (SAK-399).
//
//   npm run build:vehicles
//
// Run after any change to the vocabulary, to word-definitions.json, or to
// vehicles-build.ts. src/lib/grammar/vehicles.equiv.test.ts fails until it is
// rerun.
//
// Like build-vocab-runtime.mjs, this reaches the derivation through the module
// the app reads (vehicles.ts, for `transitivityOf`), so the generated file has
// to exist for the script to run. It is committed, as the other generated
// tables are.

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildVehicles } from "../src/lib/grammar/vehicles-build.ts";

const pools = buildVehicles();
const vehiclesVersion = createHash("sha256")
  .update(JSON.stringify(pools))
  .digest("hex")
  .slice(0, 16);

const outPath = fileURLToPath(new URL("../src/data/generated/vehicles.json", import.meta.url));
const text = JSON.stringify({ vehiclesVersion, ...pools });
writeFileSync(outPath, text + "\n");

console.log(
  `vehicles.json written: ${pools.verbVehicles.length} verb vehicles, ` +
    `${(text.length / 1024).toFixed(1)} KB, version ${vehiclesVersion}`,
);
