// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/number-construction.test.ts
//
// The construction pages present their worked examples as grammar-style Regular /
// Irregular tables (exampleGroups). These pin the SPLIT — which counts land in
// which table — the three-column shape of every row (the number/count, the kanji
// word with its engine reading, and the annotated build equation), and that every
// reading is the engine's, so a page can never state a reading the app does not
// ship. A page with a single group renders untitled: the "Regular" title only
// earns its place when an Irregular table sits beside it (IntroCountTables owns
// that render rule, so here we pin the group COUNT it keys off).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { numberConstructionRow } from "./number-construction.ts";
import { countGroupHasBuild } from "./phase-intros.ts";
import { counterIrregulars } from "../lib/engine/number-quiz.ts";
import { counterReading, numberReading } from "../lib/number-reading.ts";

const groupsOf = (id: string) => numberConstructionRow(id)!.exampleGroups;
const titles = (id: string) => groupsOf(id).map((g) => g.title);
const rowsOf = (id: string, title: string) =>
  groupsOf(id)
    .find((g) => g.title === title)!
    .examples;
const labels = (id: string, title: string) => rowsOf(id, title).map((r) => r.label);
/** The count a counter row is about, read back off its kanji word (十本 → 10). */
const countOf = (word: string) => [..."一二三四五六七八九十"].indexOf(word[0]) + 1;

describe("a single-group page renders untitled; the title needs both groups", () => {
  test("the tens page is one group — no sound shifts past ten", () => {
    assert.equal(groupsOf("tens").length, 1);
    assert.deepEqual(titles("tens"), ["Regular"]);
  });

  test("〜枚 and 〜台 have no shifts, so a single group", () => {
    assert.equal(groupsOf("mai").length, 1);
    assert.equal(groupsOf("dai").length, 1);
  });

  test("the big page and 〜本 carry both groups, so their titles show", () => {
    assert.deepEqual(titles("big"), ["Regular", "Irregular"]);
    assert.deepEqual(titles("hon"), ["Regular", "Irregular"]);
  });
});

describe("column 1 — the number, or the count with its English noun", () => {
  test("number tables show the bare numeral, no thousands separators", () => {
    assert.deepEqual(labels("big", "Regular"), [
      "100", "200", "400", "500", "700",
      "1000", "2000", "4000", "5000", "7000",
      "10000", "100000",
    ]);
    assert.deepEqual(labels("big", "Irregular"), ["300", "600", "800", "3000", "8000"]);
    assert.deepEqual(labels("tens", "Regular"), ["11", "12", "20", "34", "58", "99"]);
  });

  test("counter tables show the numeral plus the noun, singular then plural", () => {
    // 〜本 counts long thin objects; n === 1 is singular.
    const one = rowsOf("hon", "Irregular").find((r) => countOf(r.word) === 1)!;
    const two = rowsOf("hon", "Regular").find((r) => countOf(r.word) === 2)!;
    assert.equal(one.label, "1 long thin object");
    assert.equal(two.label, "2 long thin objects");
    // 〜人 counts people.
    const p1 = rowsOf("nin", "Irregular").find((r) => countOf(r.word) === 1)!;
    const p3 = rowsOf("nin", "Regular").find((r) => countOf(r.word) === 3)!;
    assert.equal(p1.label, "1 person");
    assert.equal(p3.label, "3 people");
  });
});

describe("column 2 — the kanji word, whose reading is always the engine's", () => {
  test("number ranges spell the kanji and read from numberReading", () => {
    const t = rowsOf("tens", "Regular");
    assert.equal(t.find((r) => r.label === "11")!.word, "十一");
    assert.equal(t.find((r) => r.label === "34")!.word, "三十四");
    assert.equal(t.find((r) => r.label === "20")!.word, "二十");
    const b = groupsOf("big").flatMap((g) => g.examples);
    assert.equal(b.find((r) => r.label === "200")!.word, "二百");
    assert.equal(b.find((r) => r.label === "10000")!.word, "一万");
    assert.equal(b.find((r) => r.label === "100000")!.word, "十万");
    for (const r of [...t, ...b]) {
      assert.equal(r.reading, numberReading(Number(r.label)), `${r.label} reading`);
    }
  });

  test("counter rows spell 数 + counter and read from counterReading", () => {
    for (const kind of ["nin", "hon", "hiki", "ko", "satsu", "hai", "kai", "sai"] as const) {
      for (const g of groupsOf(kind)) {
        for (const r of g.examples) {
          const n = countOf(r.word);
          assert.equal(r.reading, counterReading(n, kind), `${kind} ${r.word} reading`);
        }
      }
    }
  });
});

describe("column 3 — the build equation, with accent-coloured numeric annotations", () => {
  test("a tens row is the tens word (annotated) plus the ones word, then the total", () => {
    const eleven = rowsOf("tens", "Regular").find((r) => r.label === "11")!;
    assert.deepEqual(eleven.build, [
      { kana: "じゅう", value: "10" },
      { kana: "いち", value: "1" },
    ]);
    assert.deepEqual(eleven.result, { kana: "じゅういち", value: "11" });
    // A round ten is the tens piece alone, annotated N × 10.
    const twenty = rowsOf("tens", "Regular").find((r) => r.label === "20")!;
    assert.deepEqual(twenty.build, [{ kana: "にじゅう", value: "2 × 10" }]);
    assert.deepEqual(twenty.result, { kana: "にじゅう", value: "20" });
    const thirtyFour = rowsOf("tens", "Regular").find((r) => r.label === "34")!;
    assert.deepEqual(thirtyFour.build, [
      { kana: "さんじゅう", value: "3 × 10" },
      { kana: "よん", value: "4" },
    ]);
  });

  test("a big row is the base word annotated with its make-up, then the total", () => {
    const rows = groupsOf("big").flatMap((g) => g.examples);
    const at = (label: string) => rows.find((r) => r.label === label)!;
    assert.deepEqual(at("100").build, [{ kana: "ひゃく", value: "100" }]);
    assert.deepEqual(at("200").build, [{ kana: "にひゃく", value: "2 × 100" }]);
    assert.deepEqual(at("2000").build, [{ kana: "にせん", value: "2 × 1000" }]);
    assert.deepEqual(at("10000").build, [{ kana: "いちまん", value: "10000" }]);
    assert.deepEqual(at("100000").build, [{ kana: "じゅうまん", value: "10 × 10000" }]);
    assert.deepEqual(at("300").result, { kana: "さんびゃく", value: "300" });
  });

  test("every number row's result is the whole reading with the plain total, and each build piece is annotated", () => {
    for (const id of ["tens", "big"]) {
      for (const g of groupsOf(id)) {
        for (const r of g.examples) {
          const n = Number(r.label);
          assert.equal(r.result.kana, numberReading(n), `${id} ${r.label} result kana`);
          assert.equal(r.result.value, String(n), `${id} ${r.label} result total`);
          for (const piece of r.build) {
            assert.ok(piece.value, `${id} ${r.label} build piece "${piece.kana}" is annotated`);
          }
        }
      }
    }
  });

  test("a counter row is [number (n)] + [counter] → [full (n)], counter piece unannotated", () => {
    // 二本: に (2) + ほん → にほん (2). The base counter piece carries no value.
    const two = rowsOf("hon", "Regular").find((r) => countOf(r.word) === 2)!;
    assert.deepEqual(two.build, [{ kana: "に", value: "2" }, { kana: "ほん" }]);
    assert.deepEqual(two.result, { kana: "にほん", value: "2" });
    // 三人: さん (3) + にん → さんにん (3).
    const three = rowsOf("nin", "Regular").find((r) => countOf(r.word) === 3)!;
    assert.deepEqual(three.build, [{ kana: "さん", value: "3" }, { kana: "にん" }]);
    assert.deepEqual(three.result, { kana: "さんにん", value: "3" });
    // Every counter row's result is the engine reading with the count as total.
    // The additive equation is shown for every row EXCEPT 〜人's suppletive counts
    // (ひとり / ふたり / よにん), which have no build to show.
    const NIN_SUPPLETIVE = new Set(["一人", "二人", "四人"]);
    for (const kind of ["nin", "hon", "hiki", "mai", "ko", "dai", "satsu", "hai", "kai", "sai"] as const) {
      for (const g of groupsOf(kind)) {
        for (const r of g.examples) {
          const n = countOf(r.word);
          assert.equal(r.result.kana, counterReading(n, kind), `${kind} ${r.word} result`);
          assert.equal(r.result.value, String(n), `${kind} ${r.word} total`);
          if (kind === "nin" && NIN_SUPPLETIVE.has(r.word)) {
            assert.equal(r.build.length, 0, `${kind} ${r.word} is suppletive, no equation`);
          } else {
            assert.equal(r.build.length, 2, `${kind} ${r.word} builds from number + counter`);
            assert.equal(r.build[0].value, String(n), `${kind} ${r.word} number annotated`);
            assert.equal(r.build[1].value, undefined, `${kind} ${r.word} counter piece bare`);
          }
        }
      }
    }
  });

  test("〜人's suppletive rows drop the fake additive equation (no number + にん)", () => {
    // ひとり / ふたり / よにん are their own words: build is empty, so the view shows
    // the count mapping straight to the word ("1 → ひとり"). NEVER a wrong "よん + にん".
    for (const r of rowsOf("nin", "Irregular")) {
      assert.deepEqual(r.build, [], `${r.word} shows no additive equation`);
      assert.equal(r.result.kana, counterReading(countOf(r.word), "nin"), `${r.word} result`);
      assert.equal(r.result.value, String(countOf(r.word)), `${r.word} total`);
    }
    // A regular 〜人 row still builds additively (さん + にん → さんにん).
    const three = rowsOf("nin", "Regular").find((r) => r.word === "三人")!;
    assert.deepEqual(three.build, [{ kana: "さん", value: "3" }, { kana: "にん" }]);
    // A sound-shift counter keeps its equation even when irregular (いっぽん).
    const one = rowsOf("hon", "Irregular").find((r) => r.word === "一本")!;
    assert.deepEqual(one.build, [{ kana: "いち", value: "1" }, { kana: "ほん" }]);
    assert.equal(one.result.kana, "いっぽん");
  });
});

describe("the 'How it's built' column is dropped for an all-suppletive group", () => {
  // IntroCountTable renders the third column only when countGroupHasBuild(rows) is
  // true — some row carries a real derivation. This pins the render decision the
  // view calls straight through (there is no DOM renderer in this harness).
  test("〜人's Irregular group is all-suppletive, so the column is hidden", () => {
    const irregular = rowsOf("nin", "Irregular");
    assert.ok(irregular.every((r) => r.build.length === 0), "every 〜人 irregular is suppletive");
    assert.equal(countGroupHasBuild(irregular), false);
  });

  test("〜本's Irregular group carries the sound shift, so the column stays", () => {
    assert.equal(countGroupHasBuild(rowsOf("hon", "Irregular")), true);
  });

  test("a Regular group always builds additively, so it keeps the column", () => {
    assert.equal(countGroupHasBuild(rowsOf("nin", "Regular")), true);
    assert.equal(countGroupHasBuild(rowsOf("big", "Regular")), true);
    assert.equal(countGroupHasBuild(rowsOf("tens", "Regular")), true);
  });
});

describe("every table declares which header its first column takes", () => {
  test("number ranges are Number tables, counters are Counter tables", () => {
    for (const id of ["tens", "big"]) {
      for (const g of groupsOf(id)) assert.equal(g.counter, false, `${id} is a number table`);
    }
    for (const kind of ["nin", "hon", "mai", "dai"]) {
      for (const g of groupsOf(kind)) assert.equal(g.counter, true, `${kind} is a counter table`);
    }
  });
});

describe("the counter pages split by the engine's irregular counts", () => {
  test("〜本 puts its shifting counts (1,3,6,8,10) in the Irregular table", () => {
    const irregular = rowsOf("hon", "Irregular").map((r) => r.word);
    assert.deepEqual(irregular, ["一本", "三本", "六本", "八本", "十本"]);
    const regular = rowsOf("hon", "Regular").map((r) => r.word);
    assert.deepEqual(regular, ["二本", "四本", "五本", "七本", "九本"]);
  });

  test("〜人's Irregular table is exactly ひとり / ふたり / よにん", () => {
    assert.deepEqual(
      rowsOf("nin", "Irregular").map((r) => r.reading),
      ["ひとり", "ふたり", "よにん"],
    );
  });

  test("the split matches counterIrregulars for every counter", () => {
    for (const kind of ["nin", "hon", "hiki", "ko", "satsu", "hai", "kai", "sai"] as const) {
      const shifts = new Set(counterIrregulars(kind));
      const groups = groupsOf(kind);
      for (const r of groups.find((g) => g.title === "Regular")!.examples) {
        assert.ok(!shifts.has(countOf(r.word)), `${kind} ${r.word} should be regular`);
      }
      const irregular = groups.find((g) => g.title === "Irregular");
      if (irregular) {
        for (const r of irregular.examples) {
          assert.ok(shifts.has(countOf(r.word)), `${kind} ${r.word} should be irregular`);
        }
      }
    }
  });
});
