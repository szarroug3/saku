// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/grammar/n3.test.ts
//
// The N3 depth batch and the aspectual/desiderative producers that shipped with
// it. This file is the correctness net the brief asked for: it proves each new
// row GENERATES real forms without drift, that the recognition rows are never
// asked "build it", and that the producers yield exactly one accepted answer per
// vehicle with the prompt never among the answers.
//
// It does NOT — cannot — prove the grammar is correct Japanese. That is the
// owner's verification pass; the glosses, hosts and example strings are quoted
// in the build report for exactly that reason. What is mechanised here is the
// part a machine can own: the forms build, they build the same way every time,
// and the askability gates classify each row the way its design says.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { apply } from "../../lib/grammar/apply.ts";
import { buildExample } from "../../lib/grammar/example.ts";
import { production, variedProduction } from "../../lib/grammar/questions.ts";
import { VERB_VEHICLES, vehiclesFor } from "../../lib/grammar/vehicles.ts";
import { RECIPES, isProducible, isVacuous, recipe } from "./recipes.ts";
import type { WordClass } from "../../lib/conjugate/index.ts";

/** Build a recipe on a word and return the string, asserting it succeeded. */
function built(id: string, word: string, cls: WordClass | null): string {
  const out = apply(recipe(id)!, word, cls);
  assert.ok(out.ok, `${id} refused ${word}`);
  return out.value;
}

/** The recognition (clause-level) N3 rows: meaning-only by construction. */
const RECOGNITION = [
  "wake-da",
  "ni-chigainai",
  "hazu-ga-nai",
  "tame-ni",
  "okage-de",
  "sei-de",
  "you-ni-naru",
  "you-ni-suru",
  "ni-tsuite",
  "to-shite",
  "beki-da",
  "wake-ni-wa-ikanai",
] as const;

/** The producers that shipped alongside — [V-stem] + a compound-verb suffix. */
const PRODUCERS = ["tagaru", "hajimeru", "tsuzukeru"] as const;

/** Every id this file is about, and a guard that each is really in the table. */
const NEW_IDS = [...RECOGNITION, ...PRODUCERS];

describe("the N3 batch is present and well-formed", () => {
  test("every id names a real recipe, tagged N3 or (for the producers) N4", () => {
    for (const id of NEW_IDS) {
      const r = recipe(id);
      assert.ok(r, `no recipe '${id}'`);
    }
    for (const id of RECOGNITION) assert.equal(recipe(id)!.level, "N3", id);
    for (const id of PRODUCERS) assert.equal(recipe(id)!.level, "N4", id);
  });
});

describe("recognition rows are recognition, not production", () => {
  // The whole point of the N3 classification: these attach to a clause, so
  // "now build it" would be the clause retyped plus a fixed string. isVacuous
  // computes that; isProducible must therefore refuse them, and the production
  // generator must return null even when handed a legal-looking word.
  for (const id of RECOGNITION) {
    test(`${id} is vacuous, non-producible, and refuses a production question`, () => {
      const r = recipe(id)!;
      assert.ok(isVacuous(r), `${id} should be vacuous (recognition-only)`);
      assert.ok(!isProducible(r), `${id} must not be producible`);
      assert.equal(variedProduction(id), null, `${id} must not vary a production`);
      // Even asked point-blank on a word of its host, it refuses.
      assert.equal(production(id, "行く", "v5k-s"), null, `${id} built a production anyway`);
    });
  }
});

describe("recognition rows build real Japanese on their example words", () => {
  // The forms the Library's formula card and the cluster page print. Each is a
  // fixed string the owner can eyeball in the report; asserting them here pins
  // them so a re-cut of the conjugation data cannot silently change what shows.
  const CASES: ReadonlyArray<[string, string, WordClass | null, string]> = [
    ["wake-da", "行く", "v5k-s", "行くわけだ"],
    ["ni-chigainai", "行く", "v5k-s", "行くに違いない"],
    ["ni-chigainai", "高い", "adj-i", "高いに違いない"],
    ["ni-chigainai", "本", null, "本に違いない"],
    ["hazu-ga-nai", "行く", "v5k-s", "行くはずがない"],
    ["hazu-ga-nai", "高い", "adj-i", "高いはずがない"],
    ["tame-ni", "行く", "v5k-s", "行くために"],
    ["tame-ni", "本", null, "本のために"],
    ["okage-de", "本", null, "本のおかげで"],
    ["sei-de", "本", null, "本のせいで"],
    ["you-ni-naru", "行く", "v5k-s", "行くようになる"],
    ["you-ni-suru", "行く", "v5k-s", "行くようにする"],
    ["ni-tsuite", "本", null, "本について"],
    ["to-shite", "本", null, "本として"],
    ["beki-da", "行く", "v5k-s", "行くべきだ"],
    ["wake-ni-wa-ikanai", "行く", "v5k-s", "行くわけにはいかない"],
  ];
  for (const [id, word, cls, want] of CASES) {
    test(`${id}: ${word} → ${want}`, () => {
      const out = apply(recipe(id)!, word, cls);
      assert.ok(out.ok, `${id} refused ${word}`);
      assert.equal(out.value, want);
    });
  }
});

describe("the producers produce — one answer per vehicle, prompt never the answer", () => {
  for (const id of PRODUCERS) {
    test(`${id} is producible and bakes an example`, () => {
      const r = recipe(id)!;
      assert.ok(isProducible(r), `${id} must be producible`);
      assert.ok(!isVacuous(r), `${id} transforms its host`);
      assert.ok(buildExample(r), `${id} must bake a production example`);
    });

    test(`${id} builds on every verb vehicle, transforms it, and grades unique`, () => {
      const r = recipe(id)!;
      // Every verb in the pool is legal for these (they combine as freely as
      // 〜たい / 〜すぎる), so the pool the drill draws from is the whole verb set.
      const pool = vehiclesFor(r, "verb");
      assert.equal(pool.length, VERB_VEHICLES.length, `${id} lost vehicles`);
      for (const v of pool) {
        const built = apply(r, v.surface, v.cls);
        assert.ok(built.ok, `${id} refused ${v.surface}`);
        // The prompt is never itself an accepted answer.
        assert.notEqual(built.value, v.surface, `${id} left ${v.surface} untouched`);
        // The suffix really attached — the built form ends in it.
        assert.ok(built.value.endsWith(recipe(id)!.attach[0]!.add), `${id} on ${v.surface}`);
        // Exactly one accepted answer: a production question carries a single
        // string, and re-running the recipe is deterministic.
        const q = production(id, v.surface, v.cls as WordClass);
        assert.ok(q, `${id} refused a production on ${v.surface}`);
        assert.equal(q!.answer, built.value);
      }
    });
  }

  test("spot-check the baked forms the drill anchors on", () => {
    assert.equal(built("tagaru", "行く", "v5k-s"), "行きたがる");
    assert.equal(built("hajimeru", "食べる", "v1"), "食べ始める");
    assert.equal(built("tsuzukeru", "書く", "v5k"), "書き続ける");
    // The irregulars survive the stem, which is the whole reason to test them.
    assert.equal(built("tagaru", "する", "vs-i"), "したがる");
    assert.equal(built("hajimeru", "来る", "vk"), "来始める");
  });
});

describe("the batch does not disturb the table's invariants", () => {
  test("no two new recipes share a pattern label", () => {
    const seen = new Set<string>();
    for (const id of NEW_IDS) {
      const p = recipe(id)!.pattern;
      assert.ok(!seen.has(p), `duplicate pattern ${p}`);
      seen.add(p);
    }
  });

  test("every new recipe is reachable from RECIPES exactly once", () => {
    for (const id of NEW_IDS) {
      assert.equal(RECIPES.filter((r) => r.id === id).length, 1, id);
    }
  });
});
