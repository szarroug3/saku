// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/apply.test.ts
//
// Same harness as the conjugation engine's test, for the same reason: if a
// recipe is wrong, the drill teaches wrong Japanese, and the worst outputs are
// the ones that look fine. よそう looks fine. It is a different word.
//
// This file tests the LAYER, not the engine — the engine has its own 78 tests
// and they cover 音便 and the suppletives. What's tested here is: does a recipe
// row compose with the engine correctly, and does every row in the table
// produce real Japanese.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { apply, accepts, hostOfClass } from "./apply";
import { DRILLABLE, RECIPES, isVacuous, recipe } from "../../data/grammar/recipes";
import type { WordClass } from "../conjugate/types";

/** Assert a recipe builds exactly this string on this word. */
function eq(id: string, word: string, cls: WordClass | null, want: string) {
  const r = recipe(id);
  assert.ok(r, `no recipe '${id}'`);
  const got = apply(r, word, cls);
  assert.ok(got.ok, `${id} + ${word} was refused: ${got.ok ? "" : got.detail}`);
  assert.equal(got.value, want, `${id} + ${word}`);
}

/** Assert a recipe refuses this word, for the stated reason. */
function refuses(id: string, word: string, cls: WordClass | null, reason: string) {
  const r = recipe(id);
  assert.ok(r, `no recipe '${id}'`);
  const got = apply(r, word, cls);
  assert.ok(!got.ok, `${id} + ${word} should refuse, got "${got.ok ? got.value : ""}"`);
  assert.equal(got.reason, reason);
}

// ===========================================================================
// The mechanism: form + suffix, and the engine does the hard part
// ===========================================================================

describe("a recipe is a form name and a suffix", () => {
  test("〜てから rides the 音便 branch without knowing it exists", () => {
    eq("te-kara", "話す", "v5s", "話してから");
    eq("te-kara", "読む", "v5m", "読んでから"); // んで, not んて — から doesn't care
    eq("te-kara", "待つ", "v5t", "待ってから");
    eq("te-kara", "行く", "v5k-s", "行ってから"); // the 行く exception, free
    eq("te-kara", "食べる", "v1", "食べてから");
  });

  test("the suppletive paradigms compose too", () => {
    eq("te-kara", "する", "vs-i", "してから");
    eq("te-kara", "勉強する", "vs-i", "勉強してから");
    eq("te-kara", "来る", "vk", "来てから");
  });

  test("a `trim` recipe: 〜なければならない is ない minus い", () => {
    eq("nakereba-naranai", "話す", "v5s", "話さなければならない");
    eq("nakereba-naranai", "食べる", "v1", "食べなければならない");
    eq("nakereba-naranai", "する", "vs-i", "しなければならない");
  });

  test("the stem recipes take 連用形, not the ます form", () => {
    eq("nagara", "読む", "v5m", "読みながら"); // 読みながら, never 読みますながら
    eq("nagara", "する", "vs-i", "しながら");
    eq("kata", "書く", "v5k", "書き方");
  });

  test("adjective stem is the い-less stem", () => {
    eq("sugiru", "高い", "adj-i", "高すぎる");
    eq("sugiru", "静か", "adj-na", "静かすぎる");
  });
});

// ===========================================================================
// The さ-insertion — the one `except` table, and the one that bites
// ===========================================================================

describe("〜そう (様態) and the さ-insertion", () => {
  test("an い-adjective with a one-mora stem takes さ", () => {
    // Without the except table this emits よそう, which is not a wrong form of
    // いい — it is 予想, a different word. The failure is invisible downstream.
    eq("sou-appearance", "いい", "adj-ix", "よさそう");
    eq("sou-appearance", "よい", "adj-ix", "よさそう");
    eq("sou-appearance", "良い", "adj-ix", "良さそう");
    eq("sou-appearance", "ない", "adj-i", "なさそう");
    eq("sou-appearance", "無い", "adj-i", "無さそう");
  });

  test("adj-ix carries its compounds for free", () => {
    eq("sou-appearance", "気持ちいい", "adj-ix", "気持ちよさそう");
  });

  test("adjectives that merely END in ない do NOT take さ", () => {
    // The tempting rule (endsWith "ない") is wrong here, and these are why:
    // their stems are three morae, not one. きたなさそう is not a word.
    eq("sou-appearance", "汚い", "adj-i", "汚そう");
    eq("sou-appearance", "危ない", "adj-i", "危なそう");
    eq("sou-appearance", "少ない", "adj-i", "少なそう");
  });

  test("ordinary adjectives and verbs are untouched", () => {
    eq("sou-appearance", "高い", "adj-i", "高そう");
    eq("sou-appearance", "静か", "adj-na", "静かそう");
    eq("sou-appearance", "降る", "v5r", "降りそう");
  });
});

// ===========================================================================
// Refusals are values, and usually the right answer
// ===========================================================================

describe("a recipe that can't apply says so", () => {
  test("host mismatch: 〜てください does not take an adjective", () => {
    refuses("te-request", "高い", "adj-i", "host-mismatch");
    refuses("nagara", "静か", "adj-na", "host-mismatch");
  });

  test("a noun host has no form to conjugate", () => {
    refuses("te-kara", "本", null, "host-mismatch");
  });

  test("engine defectiveness propagates as form-refused", () => {
    // ある has no potential; the recipe must not invent one.
    refuses("potential", "ある", "v5r-i", "form-refused");
  });

  test("noun recipes attach to the bare word", () => {
    eq("wo", "本", null, "本を");
    eq("kara-source", "東京", null, "東京から");
  });

  test("accepts() agrees with apply() on hosts", () => {
    for (const r of RECIPES) {
      for (const cls of ["v5m", "adj-i", "adj-na", null] as (WordClass | null)[]) {
        const res = apply(r, cls === "adj-na" ? "静か" : cls === null ? "本" : "読む", cls);
        const hostOk = res.ok || res.reason !== "host-mismatch";
        // accepts() is a pure host test; it must not disagree about hosts.
        if (accepts(r, cls)) assert.ok(hostOk, `${r.id} accepts ${cls} but refused on host`);
      }
    }
  });
});

// ===========================================================================
// The table itself
// ===========================================================================

describe("the recipe table is well-formed", () => {
  test("ids are unique", () => {
    const ids = RECIPES.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("every recipe builds real output on at least one probe word", () => {
    const probes: [string, WordClass | null][] = [
      ["読む", "v5m"],
      ["食べる", "v1"],
      ["する", "vs-i"],
      ["高い", "adj-i"],
      ["静か", "adj-na"],
      ["本", null],
    ];
    for (const r of RECIPES) {
      const any = probes.some(([w, c]) => apply(r, w, c).ok);
      assert.ok(any, `${r.id} (${r.pattern}) builds nothing on any probe word`);
    }
  });

  test("no recipe emits an empty string or leaks a trim", () => {
    for (const r of RECIPES) {
      const res = apply(r, "読む", "v5m");
      if (res.ok) {
        assert.ok(res.value.length > 0, `${r.id} emitted empty`);
        assert.ok(!res.value.includes("undefined"), `${r.id} leaked undefined`);
      }
    }
  });

  test("isVacuous is computed, and identifies the typing questions", () => {
    // は on a noun: "give me the は form of 私" is not a question.
    assert.ok(isVacuous(recipe("wa-yori")!));
    assert.ok(isVacuous(recipe("koto-ga-dekiru")!)); // 食べる + ことができる
    // てから conjugates, so it is a real drill.
    assert.ok(!isVacuous(recipe("te-kara")!));
    assert.ok(!isVacuous(recipe("nakereba-naranai")!));
  });

  test("DRILLABLE excludes exactly the vacuous rows", () => {
    assert.equal(DRILLABLE.length, RECIPES.filter((r) => !isVacuous(r)).length);
    assert.ok(DRILLABLE.every((r) => !isVacuous(r)));
  });

  test("hostOfClass maps every engine class", () => {
    // adj-ix is an い-adjective for recipe purposes; the class split is about
    // its stem, which is the engine's business and not a recipe's.
    assert.equal(hostOfClass("adj-ix"), "adj-i");
    assert.equal(hostOfClass("vs-i"), "verb");
    assert.equal(hostOfClass("adj-na"), "adj-na");
  });

  test("clustered recipes name a cluster that exists", async () => {
    const { CLUSTERS } = await import("../../data/grammar/clusters");
    const known = new Set(CLUSTERS.map((c) => c.id));
    for (const r of RECIPES) {
      if (r.cluster) assert.ok(known.has(r.cluster), `${r.id} names unknown cluster '${r.cluster}'`);
    }
  });
});
