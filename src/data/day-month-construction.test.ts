// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/day-month-construction.test.ts
//
// DAY and MONTH are two more NUMBER_CONSTRUCTIONS pages — a rule-plus-
// exceptions reference page for 〜日/〜月, matching the shape every other
// construction page in number-construction.test.ts already pins. These tests
// pin the SAME kind of thing that file does for the counter/number pages: the
// group split, that every reading is the engine's (day-month-reading.ts), and
// that every word is the real shipped form — never a second hand-typed copy.
// SAK-163 round 4: day/month are now GENERATIVE categories (a quizConfig, and
// a category fact — see counter-categories.test.ts and counter-shelf.test.ts
// for the drillable side), so this file's own "no quizConfig" pin is gone —
// see the describe block below for its replacement.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DAYS, MONTHS } from "./counters.ts";
import { DAY, MONTH } from "./day-month-construction.ts";
import { numberConstructionForCounterGlyph, numberConstructionRow } from "./number-construction.ts";
import { CONSTRUCTION_CATEGORIES } from "./counter-categories.ts";
import { dayReading, monthReading } from "../lib/day-month-reading.ts";

const dayGroups = () => DAY.exampleGroups;
const monthGroups = () => MONTH.exampleGroups;
const rowsOf = (groups: typeof DAY.exampleGroups, title: string) =>
  groups.find((g) => g.title === title)!.examples;

describe("DAY and MONTH are registered construction pages", () => {
  test("both resolve by id, each with a generative round (SAK-163 round 4)", () => {
    const day = numberConstructionRow("day")!;
    const month = numberConstructionRow("month")!;
    assert.ok(day, "day resolves");
    assert.ok(month, "month resolves");
    assert.ok(day.quizConfig, "day has a generative round");
    assert.deepEqual(day.quizConfig!.counters, ["day"]);
    assert.equal(day.quizConfig!.numberMax, 31);
    assert.ok(month.quizConfig, "month has a generative round");
    assert.deepEqual(month.quizConfig!.counters, ["month"]);
    assert.equal(month.quizConfig!.numberMax, 12);
  });

  test("a counted day/month form's own page now links to its rule page", () => {
    // SAK-35's join (numberConstructionForCounterGlyph) is keyed on the plain
    // counter glyph (〜${glyph}); DAY/MONTH's own glyph (〜日, 〜月) makes every
    // individual 14日/9月-etc. page resolve one, the same way 二十歳's page
    // already links to 〜歳.
    const day = numberConstructionForCounterGlyph("日");
    const month = numberConstructionForCounterGlyph("月");
    assert.equal(day?.id, "day");
    assert.equal(month?.id, "month");
  });
});

describe("DAY — three groups: memorized 1st-10th, then Regular/Irregular for 11th-31st", () => {
  test("group titles and sizes", () => {
    assert.deepEqual(
      dayGroups().map((g) => g.title),
      ["1st–10th (memorized)", "Regular (11th–31st)", "Irregular (11th–31st)"],
    );
    assert.equal(rowsOf(dayGroups(), "1st–10th (memorized)").length, 10);
    // 11-31 is 21 counts; isDayException names exactly 7 of them (14,17,19,20,24,27,29).
    assert.equal(rowsOf(dayGroups(), "Regular (11th–31st)").length, 14);
    assert.equal(rowsOf(dayGroups(), "Irregular (11th–31st)").length, 7);
  });

  test("the Irregular group is exactly the ticket's 14/20/24 plus the branch-digit 17/19/27/29", () => {
    const nths = rowsOf(dayGroups(), "Irregular (11th–31st)").map((r) => r.label);
    assert.deepEqual(nths, ["14th", "17th", "19th", "20th", "24th", "27th", "29th"]);
  });

  test("every row's reading is dayReading(n)'s, and its word is the real shipped glyph", () => {
    const DAY_FORMS = DAYS;
    for (const group of dayGroups()) {
      for (const row of group.examples) {
        const n = DAY_FORMS.findIndex((f) => f.glyph === row.word) + 1;
        assert.ok(n > 0, `${row.word} is a real shipped day form`);
        assert.equal(row.reading, dayReading(n), `day ${n} reading`);
        assert.equal(row.reading, DAY_FORMS[n - 1].reading, `day ${n} matches counters.ts`);
      }
    }
  });

  test("a memorized 1st-10th row has no build equation; a regular/irregular row does", () => {
    for (const row of rowsOf(dayGroups(), "1st–10th (memorized)")) {
      assert.deepEqual(row.build, [], `${row.word} is memorised, no equation`);
    }
    for (const row of rowsOf(dayGroups(), "Regular (11th–31st)")) {
      assert.ok(row.build.length > 0, `${row.word} builds additively`);
    }
    // 20th (はつか) is fully suppletive even inside the Irregular group — no
    // equation, unlike 14th/24th (よっか) and 17th/19th/27th/29th (branch digit),
    // which still build from a tens part.
    const twentieth = rowsOf(dayGroups(), "Irregular (11th–31st)").find((r) => r.label === "20th")!;
    assert.deepEqual(twentieth.build, []);
    const fourteenth = rowsOf(dayGroups(), "Irregular (11th–31st)").find((r) => r.label === "14th")!;
    assert.ok(fourteenth.build.length > 0, "14th still builds from 十 + よっか");
  });
});

describe("MONTH — two groups: Regular (9), Irregular (4, 7, 9)", () => {
  test("group titles and sizes", () => {
    assert.deepEqual(monthGroups().map((g) => g.title), ["Regular", "Irregular"]);
    assert.equal(rowsOf(monthGroups(), "Regular").length, 9);
    assert.equal(rowsOf(monthGroups(), "Irregular").length, 3);
  });

  test("the Irregular group is exactly 4, 7 and 9 — the ticket named only 4 and 9", () => {
    // SAK-163's brief claimed "the only two irregulars are 4月 and 9月", but
    // counters.ts's real shipped 7月 is しちがつ, not なながつ — the SAME
    // alternate-branch exception 4月/9月 take. This test pins the corrected,
    // data-verified set of three, not the brief's two.
    const readings = rowsOf(monthGroups(), "Irregular").map((r) => r.reading);
    assert.deepEqual(readings, ["しがつ", "しちがつ", "くがつ"]);
  });

  test("every row's reading is monthReading(n)'s, and its word is the real shipped glyph", () => {
    const MONTH_FORMS = MONTHS;
    for (const group of monthGroups()) {
      for (const row of group.examples) {
        const n = MONTH_FORMS.findIndex((f) => f.glyph === row.word) + 1;
        assert.ok(n > 0, `${row.word} is a real shipped month form`);
        assert.equal(row.reading, monthReading(n), `month ${n} reading`);
        assert.equal(row.reading, MONTH_FORMS[n - 1].reading, `month ${n} matches counters.ts`);
        // Every month row builds additively — unlike DAY, there is no
        // suppletive/whole-word tier for MONTH.
        assert.ok(row.build.length > 0, `${row.word} builds additively`);
      }
    }
  });

  test("month row labels are the real English gloss (April), not a re-typed name", () => {
    const april = rowsOf(monthGroups(), "Irregular").find((r) => r.word === "４月")!;
    assert.equal(april.label, "April");
  });
});

describe("SAK-163 round 4: the lesson rule card is now DERIVED, not authored twice", () => {
  // The bespoke DAY_RULE_INTRO/MONTH_RULE_INTRO cards (round 2 through round 3)
  // are gone: a generative category's rule card is built automatically from its
  // construction page (counter-categories.ts's counterIntro()), the same
  // mechanism every other counter (〜本, 〜人, the tens) already uses. These pin
  // that DAY/MONTH's auto-built card carries the SAME body as the reference
  // page, PLUS a worked table (unlike round 2's prose-only card) — see
  // lesson-steps.ts's generative-marker branch for where this card is shown.
  test("DAY/MONTH resolve to a construction category, one per id", () => {
    for (const id of ["day", "month"] as const) {
      const cat = CONSTRUCTION_CATEGORIES.find((c) => c.id === id);
      assert.ok(cat, `${id} has no construction category`);
    }
  });

  test("the derived rule card shares its body with the reference page, verbatim", () => {
    const dayCat = CONSTRUCTION_CATEGORIES.find((c) => c.id === "day")!;
    const monthCat = CONSTRUCTION_CATEGORIES.find((c) => c.id === "month")!;
    // counterIntro() copies the body array (`[...c.body]`) rather than sharing
    // the reference — deepEqual, the same content check every other card's
    // body-sharing test in this codebase already settles for once a copy is
    // involved.
    assert.deepEqual(dayCat.intro.body, DAY.body);
    assert.deepEqual(monthCat.intro.body, MONTH.body);
  });

  test("the derived rule card DOES carry a worked table now — the same one the reference page shows", () => {
    const dayCat = CONSTRUCTION_CATEGORIES.find((c) => c.id === "day")!;
    const monthCat = CONSTRUCTION_CATEGORIES.find((c) => c.id === "month")!;
    assert.equal(dayCat.intro.countTables, DAY.exampleGroups);
    assert.equal(monthCat.intro.countTables, MONTH.exampleGroups);
  });
});
