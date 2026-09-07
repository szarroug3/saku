// BUILD THE CATALOGUES: src/data/generated/sky-catalogue.json,
// sky-catalogue-base.json and atlas-catalogue.json, so the modules that
// serve them parse a file at load instead of running the sky and Atlas
// pipelines over an empty history on every cold start (SAK-399).
//
//   npm run build:catalogues
//
// Run after any change to the library's data or to what a star or tile
// carries. src/app/(sky)/catalogue-build.test.ts fails until it is rerun.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildAtlasCatalogue, buildSkyBase, buildSkyCatalogue } from "../src/app/(sky)/catalogue-build.ts";

const write = (name, value) => {
  const text = JSON.stringify(value);
  writeFileSync(fileURLToPath(new URL(`../src/data/generated/${name}`, import.meta.url)), text + "\n");
  console.log(`${name}: ${(text.length / 1048576).toFixed(2)} MB`);
};
const sky = buildSkyCatalogue();
write("sky-catalogue.json", sky);
write("sky-catalogue-base.json", buildSkyBase());
const atlas = buildAtlasCatalogue();
write("atlas-catalogue.json", atlas);
console.log(`sky ${sky.items.length} items (${sky.version}); atlas ${atlas.items.length} items, ${atlas.shelves.length} shelves (${atlas.version})`);
