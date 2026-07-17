// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/build.test.ts
//
// The cluster page's middle column claims it cannot be wrong. That claim is
// only worth making if something checks it, so: these tests are the check.
//
// They are deliberately about the SHAPE of the rendered string rather than
// about conjugation — conjugate.test.ts already owns 音便, and re-asserting it
// here would just be a second place to update when a rule changes. What is
// tested here is the part this file invented: the "− trim + add" spelling, the
// degenerate no-suffix row, and the discontinuous-pattern guard.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildRow, buildRows, countWord, wordsUsed } from "./build";
import { CLUSTERS, membersOf } from "../../data/grammar/clusters";
import { RECIPES } from "../../data/grammar/recipes";

function byId(id: string) {
  const r = RECIPES.find((x) => x.id === id);
  assert.ok(r, `no recipe '${id}'`);
  return r;
}

describe("the obligation seven — the page's whole reason to exist", () => {
  test("all seven build correct Japanese on 行く", () => {
    const rows = buildRows(membersOf(CLUSTERS.find((c) => c.id === "obligation")!));
    assert.equal(rows.length, 7);
    assert.deepEqual(
      rows.map((r) => r.built),
      [
        "行かなければならない",
        "行かなければいけない",
        "行かなくてはならない",
        "行かなくてはいけない",
        "行かないといけない",
        "行かなくちゃ",
        "行かなきゃ",
      ],
    );
  });

  test("all seven gloss identically, and nothing dedupes that", () => {
    const rows = buildRows(membersOf(CLUSTERS.find((c) => c.id === "obligation")!));
    assert.deepEqual(new Set(rows.map((r) => r.recipe.gloss)), new Set(["must do X"]));
    assert.equal(rows.filter((r) => r.recipe.gloss === "must do X").length, 7);
  });
});

describe("how it's built", () => {
  test("a trim renders as − trim + add", () => {
    assert.equal(buildRow(byId("nakereba-naranai"))?.how, "行かない − い + ければならない");
  });

  test("no trim renders as base + add", () => {
    assert.equal(buildRow(byId("nai-to-ikenai"))?.how, "行かない + といけない");
  });

  // The bug this file shipped first time: "行けば + " with nothing after the +.
  test("a pattern that adds nothing renders as an arrow, never a dangling +", () => {
    assert.equal(buildRow(byId("ba"))?.how, "行く → 行けば");
    assert.equal(buildRow(byId("potential"))?.how, "行く → 行ける");
  });

  test("no row anywhere ends in a dangling operator", () => {
    for (const r of RECIPES) {
      const row = buildRow(r);
      if (!row) continue;
      assert.doesNotMatch(row.how, /[+−]\s*$/, `${r.id}: '${row.how}'`);
    }
  });

  test("the 音便 comes from the engine, not from a special case here", () => {
    // 行く is v5k-s: its て-form is 行って, not 行いて. If this row is ever
    // 行いてから, the engine broke and this page is the loudest place to notice.
    assert.equal(buildRow(byId("te-kara"))?.built, "行ってから");
  });
});

describe("discontinuous patterns are not passed off as worked examples", () => {
  test("〜は〜より is marked incomplete — apply() can only reach 本は", () => {
    const row = buildRow(byId("wa-yori"));
    assert.equal(row?.complete, false);
    assert.equal(row?.built, "本は");
  });

  test("a parenthetical annotation is not mistaken for a middle slot", () => {
    // 〜そう (様態) and 〜られる (可能) carry display annotations, and 〜られる
    // is a citation form the potential of 行く does not contain. Both are fine.
    assert.equal(buildRow(byId("sou-appearance"))?.complete, true);
    assert.equal(buildRow(byId("potential"))?.complete, true);
  });

  // Written expecting the two comparison rows; it failed and named four. The
  // other two are real and were news to me: 〜たり〜たり and 〜しか〜ない wrap
  // around a slot exactly as 〜は〜より does. Neither is in a cluster, so
  // neither reaches the page today — but the recipe model cannot express them
  // either, and the day one joins a cluster the page must not invent 本しか as
  // a worked example of "only X". Pinned as an inventory, so that day is loud.
  test("the discontinuous patterns are exactly these four, app-wide", () => {
    const bad = RECIPES.filter((r) => buildRow(r)?.complete === false).map((r) => r.id);
    assert.deepEqual(
      new Set(bad),
      new Set(["wa-yori", "hou-ga-yori", "tari-tari", "shika-nai"]),
    );
  });
});

describe("every cluster renders", () => {
  test("no clustered recipe is silently dropped from its page", () => {
    for (const c of CLUSTERS) {
      const members = membersOf(c);
      assert.equal(
        buildRows(members).length,
        members.length,
        `cluster '${c.id}' loses a member to a refused build`,
      );
    }
  });

  test("the map-only clusters have no rows, and that is not an error", () => {
    for (const id of ["wa-ga", "ni-de", "transitivity"]) {
      const c = CLUSTERS.find((x) => x.id === id)!;
      assert.equal(buildRows(membersOf(c)).length, 0);
    }
  });
});

describe("card label bits", () => {
  test("wordsUsed dedupes and keeps first-seen order", () => {
    const rows = buildRows(membersOf(CLUSTERS.find((c) => c.id === "conditionals")!));
    assert.deepEqual(wordsUsed(rows), ["行く", "本"]);
  });

  test("countWord spells small numbers and falls back past nine", () => {
    assert.equal(countWord(7), "The seven");
    assert.equal(countWord(2), "The two");
    assert.equal(countWord(12), "The 12");
  });
});
