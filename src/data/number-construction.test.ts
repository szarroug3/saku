// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/number-construction.test.ts
//
// The construction pages present their worked examples as grammar-style Regular /
// Irregular tables (exampleGroups). These pin the SPLIT — which counts land in
// which table — and that every reading is the engine's, so a page can never state
// a reading the app does not ship, and that the old inline "(shift)" flag is gone.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { numberConstructionRow } from "./number-construction.ts";
import { counterIrregulars } from "../lib/engine/number-quiz.ts";
import { counterReading, numberReading } from "../lib/number-reading.ts";

const groupsOf = (id: string) => numberConstructionRow(id)!.exampleGroups;
const titles = (id: string) => groupsOf(id).map((g) => g.title);
const arabics = (id: string, title: string) =>
  groupsOf(id)
    .find((g) => g.title === title)!
    .examples.map((e) => e.to);

describe("the number-range pages split Regular / Irregular", () => {
  test("the tens page is one Regular table — no sound shifts past ten", () => {
    assert.deepEqual(titles("tens"), ["Regular"]);
  });

  test("the big page splits the plain bases from the five that harden", () => {
    assert.deepEqual(titles("big"), ["Regular", "Irregular"]);
    assert.deepEqual(arabics("big", "Regular"), [
      "100", "200", "400", "500", "700",
      "1,000", "2,000", "4,000", "5,000", "7,000",
      "10,000", "100,000",
    ]);
    assert.deepEqual(arabics("big", "Irregular"), ["300", "600", "800", "3,000", "8,000"]);
  });

  test("every big row's reading is the engine's, never hardcoded", () => {
    for (const g of groupsOf("big")) {
      for (const ex of g.examples) {
        const n = Number(ex.to.replaceAll(",", ""));
        assert.equal(ex.reading, numberReading(n), `big ${ex.to} reading`);
        assert.equal(ex.say, ex.reading, `big ${ex.to} has a speaker`);
      }
    }
  });
});

describe("the counter pages split by the engine's irregular counts", () => {
  test("〜本 puts its shifting counts (1,3,6,8,10) in the Irregular table", () => {
    assert.deepEqual(titles("hon"), ["Regular", "Irregular"]);
    const irregularNs = groupsOf("hon")
      .find((g) => g.title === "Irregular")!
      .examples.map((e) => e.to);
    assert.deepEqual(irregularNs, ["一本", "三本", "六本", "八本", "十本"]);
    const regularNs = groupsOf("hon")
      .find((g) => g.title === "Regular")!
      .examples.map((e) => e.to);
    assert.deepEqual(regularNs, ["二本", "四本", "五本", "七本", "九本"]);
  });

  test("〜枚 and 〜台 have no shifts, so only a Regular table", () => {
    assert.deepEqual(titles("mai"), ["Regular"]);
    assert.deepEqual(titles("dai"), ["Regular"]);
  });

  test("〜人's Irregular table is exactly ひとり / ふたり / よにん", () => {
    const irregular = groupsOf("nin").find((g) => g.title === "Irregular")!;
    assert.deepEqual(
      irregular.examples.map((e) => e.reading),
      ["ひとり", "ふたり", "よにん"],
    );
  });

  test("the split matches counterIrregulars, and readings come from the engine", () => {
    for (const kind of ["nin", "hon", "hiki", "ko", "satsu", "hai", "kai", "sai"] as const) {
      const shifts = new Set(counterIrregulars(kind));
      const groups = groupsOf(kind);
      const irregular = groups.find((g) => g.title === "Irregular");
      const regular = groups.find((g) => g.title === "Regular")!;
      // Regular rows are counts NOT in the shift set; Irregular rows ARE.
      for (const ex of regular.examples) {
        const n = Number([..."一二三四五六七八九十"].indexOf(ex.to[0]) + 1);
        assert.ok(!shifts.has(n), `${kind} ${ex.to} should be regular`);
      }
      if (irregular) {
        for (const ex of irregular.examples) {
          const n = [..."一二三四五六七八九十"].indexOf(ex.to[0]) + 1;
          assert.ok(shifts.has(n), `${kind} ${ex.to} should be irregular`);
          assert.equal(ex.reading, counterReading(n, kind), `${kind} ${ex.to} reading`);
        }
      }
    }
  });
});

describe("the inline (shift) flag is gone — the table title carries that now", () => {
  test("no example gloss contains a (shift) marker anywhere", () => {
    for (const id of ["tens", "big", "nin", "hon", "hiki", "mai", "ko", "dai", "satsu", "hai", "kai", "sai"]) {
      for (const g of groupsOf(id)) {
        for (const ex of g.examples) {
          assert.ok(!ex.gloss.includes("(shift)"), `${id} still flags (shift) inline`);
        }
      }
    }
  });
});
