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

import {
  ADJ_I_VEHICLES,
  ADJ_NA_VEHICLES,
  NOUN_VEHICLES,
  VERB_VEHICLES,
  pickVehicle,
  vehiclesFor,
  type Rng,
} from "./vehicles";
import { apply } from "./apply";
import { DRILLABLE, RECIPES, recipe, type Recipe } from "../../data/grammar/recipes";

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

  test("〜方 refuses the verbs whose stem+方 is a non-word", () => {
    // 〜方 (way of X-ing) forms a COMPOUND NOUN off the masu-stem: 食べ方, 読み方.
    // That is productive for regular verbs, but the two irregulars produce a
    // string that is not the word: する's is 仕方 (しかた), which this recipe can
    // only ever spell as し方 off the phonetic stem, and 来る's 来方 (きかた) is
    // rare-to-nonstandard. Both BUILD (the conjugation is fine) so apply() keeps
    // them — the lexical fact is the one apply() cannot see — and both were dealt
    // as drill answers and graded correct. The pool must refuse them.
    const kata = recipe("kata")!;
    const offered = vehiclesFor(kata).map((v) => v.surface);
    assert.ok(!offered.includes("する"), "〜方 still offers する → し方 (real word is 仕方)");
    assert.ok(!offered.includes("来る"), "〜方 still offers 来る → 来方");
    // and it still offers the ordinary regular verbs
    assert.ok(offered.includes("食べる") && offered.includes("読む"), "〜方 lost its real vehicles");
    // nothing the pool offers builds a string outside standard orthography
    for (const v of vehiclesFor(kata)) {
      const built = apply(kata, v.surface, v.cls);
      assert.ok(built.ok && built.value !== "し方" && built.value !== "来方");
    }
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

/**
 * `except` rows that CANNOT be reached from the vehicle pool, and why each one
 * has to stay anyway.
 *
 * ない and 無い are tagged adj-i in JMdict, not adj-ix, so sou-appearance names
 * them outright to get なさそう instead of なそう. Neither is in VOCAB and
 * neither can join the pool: 〜すぎる would then build なすぎる, and the standard
 * form is なさすぎる — the app would drill a shape a learner should not write.
 * A row guarding data the app does not yet hold is defensive, not dead, and
 * deleting it would mean the day ない lands in VOCAB it lands wrong.
 *
 * Listing them HERE rather than skipping unreachable rows generally is the whole
 * point: the class row (adj-ix → よさそう) was unreachable too, for no reason at
 * all, and slipping quietly into this list is exactly what it must not do.
 */
const UNREACHABLE_BY_DESIGN: ReadonlySet<string> = new Set(["ない", "無い"]);

describe("every `except` row is REACHABLE", () => {
  test("some vehicle in the pool fires each exception", () => {
    // THE BUG, AS A GUARD. sou-appearance's さ-insertion (いい → よさそう, and
    // not よそう, which is 予想 — a different word) was written after a run
    // against real vocabulary produced the wrong string. It then sat unreachable
    // for the app's whole life: no adj-ix word existed in this pool, in
    // example.ts's HOST_EXAMPLE, or in build.ts's EXAMPLE, so no screen could
    // ever show it firing.
    //
    // Correctness code that cannot fire is worse than absent — it reads as
    // covered. The header of `except` in recipes.ts says each row is a
    // confession that the template model does not reach; a confession nobody can
    // hear is not one. So: every row must be provable on a word the app can
    // actually put in front of the user, or be named above with its reason.
    const pool = [...VERB_VEHICLES, ...ADJ_I_VEHICLES, ...ADJ_NA_VEHICLES, ...NOUN_VEHICLES];
    for (const r of RECIPES) {
      for (const e of r.except ?? []) {
        if (e.word && UNREACHABLE_BY_DESIGN.has(e.word)) continue;
        const hit = pool.filter((v) => (e.word ? e.word === v.surface : e.cls === v.cls));
        const label = e.word ?? e.cls;
        assert.ok(
          hit.length > 0,
          `${r.id}'s except row for ${label} matches no vehicle — nothing can ever show it firing`,
        );
        // Reachable is not enough: it has to actually change the output, or the
        // row is a no-op dressed as a correction.
        for (const v of hit) {
          const built = apply(r, v.surface, v.cls);
          assert.ok(built.ok, `${r.id} cannot build ${v.surface}, its own exception's word`);
          assert.ok(
            built.value.endsWith(e.add),
            `${r.id} on ${v.surface} is ${built.value}, which does not use its exception's '${e.add}'`,
          );
        }
      }
    }
  });

  test("the exempt rows are exactly the two named, and they still work", () => {
    // The exemption is a list of two words, not a policy. A third row joining it
    // is a decision someone has to make in a diff, which is the only reason the
    // first two are allowed to be there.
    const exempt = RECIPES.flatMap((r) =>
      (r.except ?? []).flatMap((e) => (e.word && UNREACHABLE_BY_DESIGN.has(e.word) ? [e.word] : [])),
    );
    assert.deepEqual(new Set(exempt), UNREACHABLE_BY_DESIGN);
    // Unreachable from the POOL is not untested: the rule itself is checked here
    // on the word it names, so the day ない becomes drillable it is already right.
    for (const w of UNREACHABLE_BY_DESIGN) {
      const built = apply(recipe("sou-appearance")!, w, "adj-i");
      assert.ok(built.ok);
      assert.equal(built.value, `${w.slice(0, -1)}さそう`);
    }
  });

  test("いい is in the pool and builds よさそう, never よそう", () => {
    // The exception's own worked example. よそう is 予想, "a forecast" — the
    // failure was not a near miss, it was a different word.
    const ii = ADJ_I_VEHICLES.find((v) => v.surface === "いい");
    assert.ok(ii, "いい left the pool and took the さ-insertion's only witness with it");
    const built = apply(recipe("sou-appearance")!, ii.surface, ii.cls);
    assert.ok(built.ok);
    assert.equal(built.value, "よさそう");
  });

  test("いい is a legal vehicle for every adj-i pattern it is offered to", () => {
    // It is the irregular one (class adj-ix, stem よ), which is why it leads the
    // pool — and why it is worth checking it does not quietly refuse to build.
    const ii = ADJ_I_VEHICLES.find((v) => v.surface === "いい")!;
    for (const r of DRILLABLE) {
      if (!vehiclesFor(r, "adj-i").some((v) => v.surface === "いい")) continue;
      const built = apply(r, ii.surface, ii.cls);
      assert.ok(built.ok && built.value !== ii.surface, `${r.id} offers いい but does not build it`);
    }
  });
});

describe("a vehicle is pinned to the fact's HOST", () => {
  test("vehiclesFor(r, host) offers only that host's words", () => {
    // Without this the split buys nothing: the adj-i fact for 〜すぎる would roll
    // 行く half the time, ask the verb fact's question, and keep the score under
    // the adjective one.
    for (const r of DRILLABLE) {
      for (const host of ["verb", "adj-i", "adj-na", "noun"] as const) {
        for (const v of vehiclesFor(r, host)) {
          assert.equal(v.host, host, `${r.id} offered a ${v.host} vehicle for the ${host} fact`);
        }
      }
    }
  });

  test("unpinned is still the union — a caller asking 'what at all' gets it", () => {
    const r = recipe("sugiru")!;
    const all = vehiclesFor(r).map((v) => v.surface);
    const split = [
      ...vehiclesFor(r, "verb"),
      ...vehiclesFor(r, "adj-i"),
      ...vehiclesFor(r, "adj-na"),
    ].map((v) => v.surface);
    assert.deepEqual(all, split);
  });

  test("pickVehicle honours the pin across the whole rng range", () => {
    const r = recipe("tara")!;
    for (const x of [0, 0.17, 0.33, 0.5, 0.66, 0.83, 0.99]) {
      assert.equal(pickVehicle(r, seq([x]), "adj-i")!.host, "adj-i");
      assert.equal(pickVehicle(r, seq([x]), "verb")!.host, "verb");
    }
  });
});

describe("the known-word gate filters the pool", () => {
  test("only vehicles the predicate accepts are offered", () => {
    const r = recipe("te-kara")!;
    // A learner who knows exactly two verbs of the pool: the rest are dropped.
    const known = (s: string) => s === "食べる" || s === "書く";
    const offered = vehiclesFor(r, "verb", known).map((v) => v.surface);
    assert.deepEqual(offered, ["食べる", "書く"]);
  });

  test("the gate only ever REMOVES: filtered is a subset, all-known is the full pool", () => {
    // The gate composes with legality rather than replacing it — it can only
    // drop legal vehicles the learner has not met, never add one or change which
    // builds are legal. So for every recipe and host: the filtered list is a
    // subset of the unfiltered one, and knowing everything reproduces it exactly.
    const knowEverything = () => true;
    const knowNothing = () => false;
    for (const r of DRILLABLE) {
      for (const host of ["verb", "adj-i", "adj-na", "noun"] as const) {
        const full = vehiclesFor(r, host).map((v) => v.surface);
        const all = vehiclesFor(r, host, knowEverything).map((v) => v.surface);
        const none = vehiclesFor(r, host, knowNothing).map((v) => v.surface);
        assert.deepEqual(all, full, `${r.id}/${host}: all-known should equal the full pool`);
        assert.deepEqual(none, [], `${r.id}/${host}: knowing nothing should offer nothing`);
      }
    }
  });

  test("knowing none of the pool leaves nothing to offer", () => {
    const r = recipe("te-kara")!;
    assert.deepEqual(vehiclesFor(r, "verb", () => false), []);
  });

  test("pickVehicle returns null when the learner knows no legal vehicle", () => {
    const r = recipe("te-kara")!;
    assert.equal(pickVehicle(r, () => 0, "verb", () => false), null);
  });

  test("pickVehicle can only ever roll a known vehicle", () => {
    const r = recipe("te-kara")!;
    const known = (s: string) => s === "読む";
    for (const x of [0, 0.25, 0.5, 0.75, 0.99]) {
      assert.equal(pickVehicle(r, seq([x]), "verb", known)!.surface, "読む");
    }
  });
});
