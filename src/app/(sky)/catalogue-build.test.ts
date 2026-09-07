// The shipped catalogues are exactly what the builders produce (SAK-399): a
// change to the library's data without `npm run build:catalogues` fails
// here, so a page can never serve a catalogue older than its data.

import assert from "node:assert/strict";
import { test } from "node:test";

import atlasJson from "@/data/generated/atlas-catalogue.json" with { type: "json" };
import baseJson from "@/data/generated/sky-catalogue-base.json" with { type: "json" };
import skyJson from "@/data/generated/sky-catalogue.json" with { type: "json" };

import { buildAtlasCatalogue, buildSkyBase, buildSkyCatalogue } from "./catalogue-build";

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

test("sky-catalogue.json is what the builder produces", () => { assert.deepEqual(plain(buildSkyCatalogue()), skyJson); });
test("sky-catalogue-base.json is what the builder produces", () => { assert.deepEqual(plain(buildSkyBase()), baseJson); });
test("atlas-catalogue.json is what the builder produces", () => { assert.deepEqual(plain(buildAtlasCatalogue()), atlasJson); });
