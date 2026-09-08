// THE SAFETY NET for the baked vehicle pools (SAK-399).
//
// The shipped src/data/generated/vehicles.json must be exactly what the LIVE
// derivation in vehicles-build.ts produces from the corpus: every vehicle, in
// order, with the same class, kana and transitivity. The drill picks its
// production vehicle out of this pool and the grader re-runs the recipe on
// whatever it picked, so a drift here would change what a learner is asked and
// what counts as right. A change to the vocabulary, to word-definitions.json or
// to the derivation without rerunning `npm run build:vehicles` fails here, so
// vehicles.ts can never read a stale file.

import assert from "node:assert/strict";
import { test } from "node:test";

import vehiclesJson from "@/data/generated/vehicles.json" with { type: "json" };
import { buildVehicles } from "@/lib/grammar/vehicles-build";
import { VERB_VEHICLES, exampleVerb, recipeAllows } from "@/lib/grammar/vehicles";
import { RECIPES } from "@/data/grammar/recipes";

const baked = vehiclesJson as unknown as {
  readonly vehiclesVersion: string;
  readonly verbVehicles: readonly { readonly surface: string }[];
  readonly defaultVerb: unknown;
  readonly restrictedVerb: unknown;
};

test("vehicles.json is what the builder derives from the corpus", () => {
  const built = JSON.parse(JSON.stringify(buildVehicles())) as Record<string, unknown>;
  const { vehiclesVersion: _version, ...shipped } = JSON.parse(
    JSON.stringify(baked),
  ) as Record<string, unknown>;
  assert.deepEqual(shipped, built);
});

test("the file carries a content hash", () => {
  assert.match(baked.vehiclesVersion, /^[0-9a-f]{16}$/);
});

test("VERB_VEHICLES is the baked pool, in the baked order", () => {
  assert.deepEqual(
    VERB_VEHICLES.map((v) => v.surface),
    baked.verbVehicles.map((v) => v.surface),
  );
});

// The two call sites the pool's own doc comment names as depending on its
// ORDER, asserted against the order the file ships rather than against a
// hand-copied expectation.
test("the pool still leads with 行く, then v5u, then v1", () => {
  assert.deepEqual(
    VERB_VEHICLES.slice(0, 2).map((v) => v.surface),
    ["行く", "言う"],
  );
  const firstV1 = VERB_VEHICLES.find((v) => v.cls === "v1");
  assert.equal(firstV1?.surface, "食べる");
});

test("a recipe that refuses 行く falls through to the pool's first acceptable verb", () => {
  const refusers = RECIPES.filter((r) => !r.transitivity && r.notOn?.includes("行く"));
  assert.ok(refusers.length > 0, "expected an unrestricted recipe with 行く in notOn");
  for (const r of refusers) {
    const first = VERB_VEHICLES.find((v) => recipeAllows(r, v.surface));
    assert.equal(exampleVerb(r).surface, first?.surface, r.id);
  }
});
