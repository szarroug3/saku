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

describe("first-learned verb across a run", () => {
  test("pickVehicle always returns the earliest-taught option, whatever the rng", () => {
    const r = recipe("te-kara")!;
    // Sam's call: an example anchors on the first-learned (lowest beginnerRank)
    // verb, not a random one — so every showing lands on the SAME verb here,
    // where the whole pool is eligible (no known-gate).
    const picks = [0.02, 0.15, 0.3, 0.45, 0.6, 0.72, 0.85, 0.93, 0.5, 0.1].map(
      (x) => pickVehicle(r, seq([x]))!.surface,
    );
    assert.equal(
      new Set(picks).size,
      1,
      `expected one anchor verb, got ${[...new Set(picks)].join(", ")}`,
    );
  });

  test("pickVehicle is null exactly when there is nothing legal to pick", () => {
    assert.equal(pickVehicle(recipe("shika-nai")!, Math.random), null);
    assert.ok(pickVehicle(recipe("te-kara")!, Math.random));
  });
});

// SAK-203 round 2: Sam re-reported the same bug class with a fresh, concrete
// example — およぐ picked independently for BOTH 〜ている ("is およぐ") and
// 〜てください ("please およぐ") in one session. Round 1 only reordered cards
// that already existed in a deck with a duplicate vehicle; it never stopped
// two SEPARATE recipes' facts from independently rolling the same word in
// the first place. `usedInDeck` is the fix: a session-aware preference
// threaded into `pickVehicle` for a word not already picked elsewhere.
describe("session-aware vehicle dedup (SAK-203 round 2)", () => {
  test("v5g had exactly one pool member before this change — SAK-214 grew it further", () => {
    // Confirms およぐ's repeat was PARTLY a data gap, not only an algorithm
    // gap: with only one v5g word in the pool, no session-awareness has
    // anything to dedupe against. SAK-203 round 2 added 急ぐ by hand as a
    // second member; SAK-214 replaced that hand-typed pair with the class's
    // whole corpus-derived pool (vehicles.ts's corpusPoolFor), so both
    // reported words are still in it, alongside many more.
    const v5g = VERB_VEHICLES.filter((v) => v.cls === "v5g").map((v) => v.surface);
    assert.ok(v5g.length > 2, `v5g should have grown past its SAK-203 size of 2: got ${v5g.length}`);
    assert.ok(v5g.includes("泳ぐ") && v5g.includes("急ぐ"), "the SAK-203 pair should still be in the pool");
  });

  test("a class with a real pool alternative is not re-picked once used", () => {
    // v1 has three members (食べる/見る/起きる) — the exact shape of the class
    // that repeated in Sam's たべる follow-up report. Scoped with a v1 bucket
    // (the way a real classProductionFactId showing always is) so the pick
    // is confined to the class under test, not the whole verb pool.
    const r = recipe("te-iru")!;
    const bucket = { kind: "class", cls: "v1" } as const;
    const first = pickVehicle(r, () => 0, "verb", undefined, bucket)!;
    assert.equal(first.surface, "食べる"); // earliest-taught, unchanged behaviour
    const usedInDeck = new Set([first.surface]);
    const second = pickVehicle(r, () => 0, "verb", undefined, bucket, usedInDeck);
    assert.notEqual(second!.surface, first.surface, "re-picked an already-used vehicle");
    assert.equal(second!.cls, "v1");
  });

  test("v5g specifically: 泳ぐ used first, 急ぐ picked second — the exact reported pair", () => {
    // Un-gated (no `known` predicate), pickVehicle's earliest-taught tie-break
    // now reaches past 泳ぐ/急ぐ into the rest of SAK-214's larger v5g pool —
    // this scopes to the SAK-203 pair specifically with a known-word gate, the
    // way the live drill actually would once a learner has met exactly these
    // two. The un-gated, whole-pool shape of this same mechanism is covered
    // by the class-agnostic test above and the v5s test below.
    const r = recipe("te-iru")!;
    const bucket = { kind: "class", cls: "v5g" } as const;
    const known = (s: string) => s === "泳ぐ" || s === "急ぐ";
    const first = pickVehicle(r, () => 0, "verb", known, bucket)!;
    assert.equal(first.surface, "泳ぐ");
    const usedInDeck = new Set(["泳ぐ"]);
    const second = pickVehicle(r, () => 0, "verb", known, bucket, usedInDeck)!;
    assert.equal(second.surface, "急ぐ", "did not fall back to the pool's second member");
  });

  test("SAK-214: 話す (v5s) is no longer forced to repeat — the ticket's own reported bug", () => {
    // The exact live report this ticket exists to fix: はなす (話す) picked
    // independently for both "please 話す" and "is 話す" in one session,
    // because v5s — like v5g before SAK-203 round 2 — had exactly ONE pool
    // member. vehicles.ts's corpusPoolFor now gives v5s real alternatives.
    const r = recipe("te-iru")!;
    const bucket = { kind: "class", cls: "v5s" } as const;
    const first = pickVehicle(r, () => 0, "verb", undefined, bucket)!;
    assert.equal(first.surface, "話す"); // still earliest-taught, unchanged default
    const usedInDeck = new Set([first.surface]);
    const second = pickVehicle(r, () => 0, "verb", undefined, bucket, usedInDeck);
    assert.notEqual(second!.surface, "話す", "re-picked 話す despite an unused pool alternative");
    assert.equal(second!.cls, "v5s");
  });

  test("an irregular's one-word pool still repeats — not a bug", () => {
    // @iku pins the fact to exactly one word; there is no alternative to fall
    // back to, ever, regardless of what's already used.
    const r = recipe("te-iru")!;
    const bucket = { kind: "verb", surface: "行く" } as const;
    const usedInDeck = new Set(["行く"]);
    const v = pickVehicle(r, Math.random, "verb", () => false, bucket, usedInDeck);
    assert.equal(v?.surface, "行く", "an irregular has no other legal vehicle to fall back to");
  });

  test("a genuinely single-member class pool still repeats — not a bug", () => {
    // v5k had exactly one pool member (書く) before SAK-214; corpusPoolFor now
    // gives it 25. v5n is the one regular class SAK-214 could NOT deepen: the
    // entire common-word corpus (VOCAB) has exactly one ぬ-ending verb, 死ぬ —
    // see vehicles.ts's MAX_POOL_PER_CLASS comment. Confirmed empirically, not
    // assumed: this test fails the day JMdict's common cut gains a second v5n
    // verb, which is the point — it should be revisited then, not silently
    // pass either way.
    assert.deepEqual(VERB_VEHICLES.filter((v) => v.cls === "v5n").map((v) => v.surface), ["死ぬ"]);
    const r = recipe("te-iru")!;
    const bucket = { kind: "class", cls: "v5n" } as const;
    const usedInDeck = new Set(["死ぬ"]);
    const v = pickVehicle(r, Math.random, "verb", undefined, bucket, usedInDeck);
    assert.equal(v?.surface, "死ぬ", "v5n's only pool member should still be offered");
  });

  test("dedup composes with the known-word preference: known+unused beats known+used", () => {
    const r = recipe("te-iru")!;
    const bucket = { kind: "class", cls: "v5g" } as const;
    const known = (s: string) => s === "泳ぐ" || s === "急ぐ";
    // Both known, 泳ぐ already used elsewhere in the deck: dedup steers to 急ぐ
    // rather than the plain earliest-taught 泳ぐ.
    const v = pickVehicle(r, () => 0, "verb", known, bucket, new Set(["泳ぐ"]));
    assert.equal(v?.surface, "急ぐ");
  });

  test("dedup never crosses from known into unknown — known+used still beats unused+unknown", () => {
    // Only 泳ぐ is known, and it's already used. There IS an unknown pool
    // alternative (急ぐ), but the known-word gate must still win outright: a
    // learner should never be handed an unmet word just to dodge a repeat.
    const r = recipe("te-iru")!;
    const bucket = { kind: "class", cls: "v5g" } as const;
    const known = (s: string) => s === "泳ぐ";
    const v = pickVehicle(r, () => 0, "verb", known, bucket, new Set(["泳ぐ"]));
    assert.equal(v?.surface, "泳ぐ", "abandoned the known word for an unmet one");
  });

  test("an empty or absent usedInDeck set changes nothing (first grammar card of a session)", () => {
    const r = recipe("te-kara")!;
    for (const x of [0, 0.3, 0.6, 0.9]) {
      const plain = pickVehicle(r, seq([x]))!.surface;
      const withEmpty = pickVehicle(r, seq([x]), undefined, undefined, undefined, new Set())!
        .surface;
      assert.equal(withEmpty, plain);
    }
  });
});

// SAK-214: VERB_VEHICLES's regular classes are drawn from the real corpus
// (src/data/vocab.ts) via `wordClassOf`, rather than hand-typed — see
// vehicles.ts's own header on the fix and its `MAX_POOL_PER_CLASS` comment on
// the cutoff/quality reasoning. These tests check the shape of the RESULT:
// the six previously single-member classes actually grew, the irregulars that
// were deliberately left alone actually stayed put, and the quality filters
// (register, resolvable transitivity) actually excluded what they claim to.
describe("SAK-214: the verb pool is drawn from the corpus, not hand-typed", () => {
  test("the six previously single-member regular classes all have multiple pool members now", () => {
    // v5k, v5s, v5t, v5b, v5r: exactly one pool member each before this
    // change (話す's repeat, reported for this ticket, is v5s's instance of
    // this). v5n is excluded here — see its own dedicated test above: the
    // corpus genuinely has only one common v5n verb, so it is expected to
    // stay a single-member pool, not a bug this change could fix.
    for (const cls of ["v5k", "v5s", "v5t", "v5b", "v5r"] as const) {
      const members = VERB_VEHICLES.filter((v) => v.cls === cls).map((v) => v.surface);
      assert.ok(members.length > 1, `${cls} is still a single-member pool: ${members.join(", ")}`);
    }
  });

  test("v5u, v5g and v1 — not thin, but also deepened for the same dedup headroom", () => {
    // Called out explicitly in the ticket: v5u/v5g had 2 members and v1 had 3,
    // not single, but still worth the same corpus-derived treatment.
    for (const cls of ["v5u", "v5g", "v1"] as const) {
      const members = VERB_VEHICLES.filter((v) => v.cls === cls).map((v) => v.surface);
      assert.ok(members.length > 3, `${cls} did not grow past its pre-SAK-214 size: ${members.length}`);
    }
  });

  test("the irregular/special classes are UNCHANGED — still pinned to one canonical word each", () => {
    // v5k-s, vs-i, vk, v5r-i are the only special classes actually reachable
    // through VERB_VEHICLES (the rest — v5u-s, v5aru, v1-s, vz, vs-s — have no
    // representative in this pool at all, exactly as before SAK-214). None of
    // this should ever grow: these are irregular precisely because there is
    // essentially one commonly-taught representative, and DEFAULT_VERB /
    // RESTRICTED_VERB / exampleVerb() all anchor on 行く / 書く specifically —
    // see this file's own header. A future change that quietly starts pulling
    // these from the corpus too would break that anchor silently; this test
    // is the tripwire.
    const irregularClasses = ["v5k-s", "vs-i", "vk", "v5r-i"] as const;
    const bySurface: Record<string, string> = {
      "v5k-s": "行く",
      "vs-i": "する",
      vk: "来る",
      "v5r-i": "ある",
    };
    for (const cls of irregularClasses) {
      const members = VERB_VEHICLES.filter((v) => v.cls === cls).map((v) => v.surface);
      assert.deepEqual(members, [bySurface[cls]], `${cls} grew past its one pinned word`);
    }
    // And no OTHER special class snuck a member in either.
    for (const cls of ["v5u-s", "v5aru", "v1-s", "vz", "vs-s"] as const) {
      assert.deepEqual(VERB_VEHICLES.filter((v) => v.cls === cls), [], `${cls} should have no pool member`);
    }
  });

  test("no honorific/humble-only word made it into the pool", () => {
    // Spot-checked against real JMdict hits the exclusion has to catch:
    // 伺う (v5u, humble "to call on"), 召し上がる/まいる/おる/承る/ご覧になる
    // (v5r, honorific/humble), 召す/申す/いたす (v5s, honorific/humble). None
    // of these should be an unlabeled filler a learner who has never studied
    // keigo is handed to conjugate — see vehicles.ts's isHonorificOrHumbleOnly.
    const surfaces = VERB_VEHICLES.map((v) => v.surface);
    for (const w of ["伺う", "召し上がる", "まいる", "おる", "承る", "ご覧になる", "召す", "申す", "いたす"]) {
      assert.ok(!surfaces.includes(w), `${w} is honorific/humble-only and should have been excluded`);
    }
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

  test("pickVehicle PREFERS a known vehicle whenever one exists", () => {
    const r = recipe("te-kara")!;
    const known = (s: string) => s === "読む";
    for (const x of [0, 0.25, 0.5, 0.75, 0.99]) {
      assert.equal(pickVehicle(r, seq([x]), "verb", known)!.surface, "読む");
    }
  });

  test("knowing NO pool verb still rolls a vehicle — never an irregular one", () => {
    // The bug this whole change fixes: a beginner who has met none of the pool
    // used to get null here, and the production item was silently not asked.
    const r = recipe("te-kara")!;
    for (const x of [0, 0.25, 0.5, 0.75, 0.99]) {
      const v = pickVehicle(r, seq([x]), "verb", () => false);
      assert.ok(v, "should still roll a vehicle when nothing is known");
      // Never an irregular whose 音便 no class label can fix — 行く / 問う, and the
      // する / 来る skills. A る-verb IS eligible now (the instruction names its
      // class); it simply does not win te-kara's earliest-taught ordering here.
      for (const bad of ["行く", "問う", "する", "来る"]) {
        assert.notEqual(v!.surface, bad, `rolled the irregular ${bad}`);
      }
    }
  });

  test("an UNKNOWN IRREGULAR verb is NEVER rolled on a free pick", () => {
    // The irregulars only — 行く / 問う (irregular 音便) and する / 来る (their own
    // memorized skills). A る-verb is NOT here any more: its class is unguessable
    // from spelling, but the instruction states it ("this る-verb"), so it is fair
    // game. The irregulars have no such rescue and stay out of a free pick; する /
    // 来る reach a card only through their own @suru / @kuru verb bucket.
    const r = recipe("te-kara")!;
    const banned = new Set(["行く", "問う", "する", "来る"]);
    for (let i = 0; i < 200; i++) {
      const v = pickVehicle(r, seq([i / 200]), "verb", () => false);
      assert.ok(v);
      assert.ok(!banned.has(v!.surface), `rolled the irregular ${v!.surface}`);
    }
  });

  test("a CLASS bucket rolls an unknown る-verb — the instruction names its class", () => {
    // The row-shift form fix (ます / ない / ば…). A v1 (ichidan) or v5r (godan-る)
    // coverage card can only be built on a る-verb, and a verb-less learner knows
    // none — so it used to fall back to 行く, kanji AND the wrong class. Now the
    // る-verb is dealt in kana; the drill names it "る-verb" / "う-verb" so the
    // conjugation is determined. See quiz-instruction.ts.
    const r = recipe("masu-form")!;
    for (const [cls, ending] of [
      ["v1", "る"],
      ["v5r", "る"],
    ] as const) {
      const v = pickVehicle(r, Math.random, "verb", () => false, { kind: "class", cls });
      assert.ok(v, `${cls} bucket rolled nothing for a verb-less learner`);
      assert.equal(v!.cls, cls);
      assert.ok(v!.surface.endsWith(ending));
    }
  });

  test("a VERB bucket rolls its pinned irregular even unknown — nothing else is legal", () => {
    // The other side of the rule above, and the fix for the te-form lesson bug.
    // @iku/@suru/@kuru pin the fact to ONE irregular verb and the fact IS that
    // verb's exception — there is no safer verb to fall back to. The general sweep
    // above passes NO bucket, so it still refuses 行く; a VERB bucket keeps it,
    // because dropping to null strands the card on its baked KANJI lemma. The
    // caller (grammarVehicleFor) then draws it in kana via known:false.
    const r = recipe("te-sequence")!;
    for (const [surface] of [["行く"], ["する"], ["来る"]] as const) {
      const v = pickVehicle(r, Math.random, "verb", () => false, {
        kind: "verb",
        surface,
      });
      assert.equal(v?.surface, surface, `${surface} bucket rolled nothing`);
    }
  });

  test("a KNOWN る-ending verb IS eligible (its class is no longer a guess)", () => {
    const r = recipe("te-kara")!;
    // 食べる is ichidan (る-ending) — banned as an unknown filler, but once the
    // learner has met it, its class is known and it becomes fair game.
    const known = (s: string) => s === "食べる";
    for (const x of [0, 0.3, 0.6, 0.9]) {
      assert.equal(pickVehicle(r, seq([x]), "verb", known)!.surface, "食べる");
    }
  });

  test("a KNOWN v5u verb can be picked for the te-form v5u bucket", () => {
    const r = recipe("te-kara")!;
    const known = (s: string) => s === "言う";
    for (const x of [0, 0.2, 0.5, 0.8]) {
      const v = pickVehicle(r, seq([x]), "verb", known, { kind: "class", cls: "v5u" });
      assert.equal(v?.surface, "言う");
    }
  });

  test("pickVehicle is still null for a wrap (nothing legal to pick)", () => {
    // Null now means only "no legal vehicle at all", not "knows nothing".
    assert.equal(pickVehicle(recipe("shika-nai")!, () => 0, undefined, () => false), null);
  });
});
