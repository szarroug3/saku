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
// degenerate no-suffix row, and the wrap rows building whole.

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

describe("patterns that wrap a slot build whole", () => {
  test("〜は〜より is the whole frame, not the 本は it used to be", () => {
    const row = buildRow(byId("wa-yori"));
    assert.equal(row?.built, "本は車より");
    assert.deepEqual(row?.on, ["本", "車"]);
    // The cell the page prints. 本は would sit beside "X is more ... than Y"
    // and teach that 本は means that.
    assert.notEqual(row?.built, "本は");
  });

  test("〜のほうが〜より likewise — the other half of the comparison cluster", () => {
    assert.equal(buildRow(byId("hou-ga-yori"))?.built, "本のほうが車より");
  });

  test("〜たり〜たり closes with する, and both slots take the 音便", () => {
    // 行く → 行った (v5k-s, the promoted-つ case) and 読む → 読んだ (v5m, ん).
    // Two different sound changes in one cell, neither typed out here.
    assert.equal(buildRow(byId("tari-tari"))?.built, "行ったり読んだりする");
  });

  test("〜しか〜ない opens on a noun and closes on a verb — different hosts", () => {
    // The row that proves the closing half needed its own host and form: しか
    // hangs off a bare 本, ない is a conjugation of 読む.
    const row = buildRow(byId("shika-nai"));
    assert.equal(row?.built, "本しか読まない");
    assert.deepEqual(row?.on, ["本", "読む"]);
  });

  test("the how column spells out both slots", () => {
    assert.equal(buildRow(byId("wa-yori"))?.how, "本 + は · 車 + より");
    // The closing half adds nothing to 読まない, so that slot degenerates to the
    // arrow spelling — the same rule as a 〜ば row, reached from the other side.
    assert.equal(buildRow(byId("shika-nai"))?.how, "本 + しか · 読む → 読まない");
  });

  test("a parenthetical annotation is not mistaken for a middle slot", () => {
    // 〜そう (様態) and 〜られる (可能) carry display annotations, and 〜られる
    // is a citation form the potential of 行く does not contain. Both are fine,
    // and neither is a wrap. The old guard sniffed the pattern STRING for a
    // second 〜 and had to argue its way past these two; the model does not
    // have to, because it never reads display text to learn structure.
    assert.equal(byId("sou-appearance").wrap, undefined);
    assert.equal(byId("potential").wrap, undefined);
    assert.equal(buildRow(byId("sou-appearance"))?.built, "行きそう");
  });

  // Was an inventory of what the model could NOT express; now an inventory of
  // what it expresses. Same four rows, and the day a fifth appears this is
  // still the loud place.
  test("the wraps are exactly these four, app-wide", () => {
    const wraps = RECIPES.filter((r) => r.wrap).map((r) => r.id);
    assert.deepEqual(
      new Set(wraps),
      new Set(["wa-yori", "hou-ga-yori", "tari-tari", "shika-nai"]),
    );
  });

  test("every wrap builds — none falls back to showing its own pattern", () => {
    for (const r of RECIPES.filter((x) => x.wrap)) {
      const row = buildRow(r);
      assert.ok(row, `${r.id} does not build`);
      assert.notEqual(row.built, r.pattern, `${r.id} built nothing but its own pattern`);
      assert.ok(!row.built.includes("〜"), `${r.id} left a slot marker in a worked example`);
    }
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
