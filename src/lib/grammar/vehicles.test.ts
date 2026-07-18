// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/vehicles.test.ts
//
// The pool exists so a production question is not forever drilled on 行く. The
// tests here are mostly the SAFETY ones: a vehicle is only offered when the
// recipe legally builds on it, because the alternative — emitting a form the
// pattern cannot take — is the same "mark correct Japanese wrong" failure the
// whole grammar subject is built to avoid.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { VERB_VEHICLES, pickVehicle, vehiclesFor, type Rng } from "./vehicles";
import { apply } from "./apply";
import { DRILLABLE, recipe, type Recipe } from "../../data/grammar/recipes";

/** A deterministic rng cycling through a fixed sequence, so a "run" is
 * reproducible. Values in [0,1). */
function seq(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("the pool covers the conjugation classes it claims to", () => {
  test("every verb vehicle carries a class the engine can drive", () => {
    for (const v of VERB_VEHICLES) {
      assert.ok(v.cls, `${v.surface} has no class`);
      // 行く is the one whose て-form is irregular — the class the pool must
      // include or it never proves the hard 音便 case.
      const te = apply(recipe("te-kara")!, v.surface, v.cls);
      assert.ok(te.ok, `${v.surface} cannot even form てから`);
    }
  });

  test("the 行く irregular is in the pool and builds 行ってから, not 行いてから", () => {
    const iku = VERB_VEHICLES.find((v) => v.surface === "行く");
    assert.ok(iku);
    const built = apply(recipe("te-kara")!, iku.surface, iku.cls);
    assert.ok(built.ok);
    assert.equal(built.value, "行ってから");
  });
});

describe("vehiclesFor offers only LEGAL vehicles", () => {
  test("every offered vehicle actually builds, and transforms the word", () => {
    for (const r of DRILLABLE) {
      for (const v of vehiclesFor(r)) {
        const built = apply(r, v.surface, v.cls);
        assert.ok(built.ok, `${r.id} offered ${v.surface} but can't build it`);
        assert.notEqual(built.value, v.surface, `${r.id} on ${v.surface} is a no-op`);
      }
    }
  });

  test("a wrap offers nothing — it needs two words", () => {
    // 〜しか〜ない is a wrap; apply() refuses a single word, so the pool must too.
    const shika = recipe("shika-nai");
    assert.ok(shika);
    assert.deepEqual(vehiclesFor(shika as Recipe), []);
  });

  test("a producible verb pattern offers several vehicles, not one", () => {
    // The whole point: てから is not stuck on 行く.
    const n = vehiclesFor(recipe("te-kara")!).length;
    assert.ok(n > 3, `te-kara offers only ${n} vehicles`);
  });
});

describe("variety across a run", () => {
  test("pickVehicle spreads across the pool as the rng advances", () => {
    const r = recipe("te-kara")!;
    // Ten showings with distinct rng draws should not all land on one verb.
    const picks = [0.02, 0.15, 0.3, 0.45, 0.6, 0.72, 0.85, 0.93, 0.5, 0.1].map(
      (x) => pickVehicle(r, seq([x]))!.surface,
    );
    assert.ok(new Set(picks).size >= 4, `only ${new Set(picks).size} distinct verbs across 10 showings`);
  });

  test("pickVehicle is null exactly when there is nothing legal to pick", () => {
    assert.equal(pickVehicle(recipe("shika-nai")!, Math.random), null);
    assert.ok(pickVehicle(recipe("te-kara")!, Math.random));
  });
});
