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
import {
  acceptableCounterReadings,
  acceptableNumberReadings,
  counterReading,
  numberReading,
} from "../lib/number-reading.ts";

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

  test("SAK-177: 〜割 and 〜円 have no shifts either, so a single group", () => {
    assert.equal(groupsOf("wari").length, 1);
    assert.equal(groupsOf("en").length, 1);
  });

  test("the big page and 〜本 carry both groups, so their titles show", () => {
    assert.deepEqual(titles("big"), ["Regular", "Irregular"]);
    assert.deepEqual(titles("hon"), ["Regular", "Irregular"]);
  });

  test("SAK-177: 〜階 carries both groups too — it has a real irregular (3)", () => {
    assert.deepEqual(titles("floor"), ["Regular", "Irregular"]);
  });
});

describe("column 1 — the number, or the count with its English noun", () => {
  test("number tables show the bare numeral, no thousands separators", () => {
    assert.deepEqual(labels("big", "Regular"), [
      "100", "200", "400", "500", "700",
      "1000", "2000", "4000", "5000", "7000",
      "10000", "100000",
      // SAK-176: the 億 tier's two worked examples — 1億 (base word) and 100億
      // (the ticket's named example, and the value the real vocab.json
      // duplicate １００億 spells out).
      "100000000", "10000000000",
    ]);
    assert.deepEqual(labels("big", "Irregular"), ["300", "600", "800", "3000", "8000"]);
    assert.deepEqual(labels("tens", "Regular"), [
      "11", "12", "20", "34", "47", "58", "99",
    ]);
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
    // SAK-176: the 億 tier — 1億 keeps its 一 (一億, same rule as 一万), and
    // 100億 is 百億, matching the real vocab.json duplicate keb's implied
    // numeral spelling.
    assert.equal(b.find((r) => r.label === "100000000")!.word, "一億");
    assert.equal(b.find((r) => r.label === "10000000000")!.word, "百億");
    for (const r of [...t, ...b]) {
      assert.equal(r.reading, numberReading(Number(r.label)), `${r.label} reading`);
    }
  });

  test("counter rows spell 数 + counter and read from counterReading", () => {
    for (const kind of ["nin", "hon", "hiki", "ko", "satsu", "hai", "kai", "sai", "wari", "floor", "en"] as const) {
      for (const g of groupsOf(kind)) {
        for (const r of g.examples) {
          // SAK-172: 〜歳's extra はたち row (count 20) is a genuinely suppletive
          // word OUTSIDE the 1-10 sweep countOf/counterReading model — the whole
          // point of the row is that it does NOT equal the engine's generated
          // にじゅっさい. See the dedicated "〜歳's Irregular table" describe block.
          if (r.word === "二十歳") continue;
          // SAK-177: 円's extra 1000円/せんえん row (count 1000) is likewise
          // OUTSIDE the 1-10 sweep countOf/counterReading model.
          if (r.word === "千円") continue;
          const n = countOf(r.word);
          assert.equal(r.reading, counterReading(n, kind), `${kind} ${r.word} reading`);
        }
      }
    }
  });

  test("the tens examples show every alternate digit branch accepted by grading", () => {
    const rows = rowsOf("tens", "Regular");
    assert.deepEqual(rows.find((r) => r.label === "34")!.alternateReadings, ["さんじゅうし"]);
    assert.deepEqual(rows.find((r) => r.label === "47")!.alternateReadings, ["よんじゅうしち"]);
    assert.deepEqual(rows.find((r) => r.label === "99")!.alternateReadings, ["きゅうじゅうく"]);

    for (const row of rows) {
      const accepted = acceptableNumberReadings(Number(row.label));
      assert.deepEqual(
        [row.reading, ...(row.alternateReadings ?? [])],
        accepted,
        `${row.label} exposes the quiz's accepted readings`,
      );
    }
  });

  test("counter examples expose their context-specific accepted alternatives", () => {
    for (const kind of ["nin", "hon", "hiki", "mai", "ko", "dai", "satsu", "hai", "kai", "sai", "wari", "floor", "en"] as const) {
      for (const group of groupsOf(kind)) {
        for (const row of group.examples) {
          // SAK-172: はたち has no engine-accepted-alternates set — it is not a
          // count acceptableCounterReadings/counterReading model at all.
          if (row.word === "二十歳") continue;
          if (row.word === "千円") continue;
          const n = countOf(row.word);
          assert.deepEqual(
            [row.reading, ...(row.alternateReadings ?? [])],
            acceptableCounterReadings(n, kind),
            `${kind} ${n} exposes the quiz's accepted readings`,
          );
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
    // 万/億 don't elide いち the way 百/千 do (いちまん, いちおく really are said with
    // いち — numberReading's own header comment says so), so unlike 100/1000
    // above, a lone 万/億 value is a real 1 × N composition, not a bare reading.
    assert.deepEqual(at("10000").build, [{ kana: "いちまん", value: "1 × 10000" }]);
    assert.deepEqual(at("100000").build, [{ kana: "じゅうまん", value: "10 × 10000" }]);
    assert.deepEqual(at("300").result, { kana: "さんびゃく", value: "300" });
    // SAK-176: the 億 tier's build annotations — 1億 as "1 × 100000000", and
    // 100億 annotated as "100 × 100000000", the same digit-in-front shape
    // 100000 ("10 × 10000") already shows one tier down.
    assert.deepEqual(at("100000000").build, [{ kana: "いちおく", value: "1 × 100000000" }]);
    assert.deepEqual(at("10000000000").build, [{ kana: "ひゃくおく", value: "100 × 100000000" }]);
    assert.deepEqual(at("10000000000").result, { kana: "ひゃくおく", value: "10000000000" });
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
    for (const kind of ["nin", "hon", "hiki", "mai", "ko", "dai", "satsu", "hai", "kai", "sai", "wari", "floor", "en"] as const) {
      for (const g of groupsOf(kind)) {
        for (const r of g.examples) {
          // SAK-172: 〜歳's はたち row (二十歳, count 20) is checked separately —
          // it is outside the 1-10 sweep countOf/counterReading model, and its
          // suppletive build=[] is pinned in the dedicated describe block above.
          if (r.word === "二十歳") continue;
          // SAK-177: 円's extra 1000円/せんえん row (count 1000) is likewise
          // OUTSIDE the 1-10 sweep countOf/counterReading model.
          if (r.word === "千円") continue;
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
    for (const kind of ["nin", "hon", "mai", "dai", "wari", "floor", "en"]) {
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

  test("SAK-177: 〜階 puts its shifting counts (1,3,6,8,10) in the Irregular table — 3 for VOICING, not hardening", () => {
    const irregular = rowsOf("floor", "Irregular");
    assert.deepEqual(irregular.map((r) => r.word), ["一階", "三階", "六階", "八階", "十階"]);
    assert.deepEqual(irregular.map((r) => r.reading), [
      "いっかい", "さんがい", "ろっかい", "はっかい", "じゅっかい",
    ]);
    const regular = rowsOf("floor", "Regular").map((r) => r.word);
    assert.deepEqual(regular, ["二階", "四階", "五階", "七階", "九階"]);
  });

  test("SAK-177: 〜割 and 〜円 have no Irregular table at all — clean counters", () => {
    assert.equal(numberConstructionRow("wari")!.exampleGroups.length, 1);
    assert.equal(
      numberConstructionRow("wari")!.exampleGroups[0]!.title,
      "Regular",
    );
  });

  test("the split matches counterIrregulars for every counter", () => {
    for (const kind of ["nin", "hon", "hiki", "ko", "satsu", "hai", "kai", "sai", "wari", "floor", "en"] as const) {
      const shifts = new Set(counterIrregulars(kind));
      const groups = groupsOf(kind);
      for (const r of groups.find((g) => g.title === "Regular")!.examples) {
        assert.ok(!shifts.has(countOf(r.word)), `${kind} ${r.word} should be regular`);
      }
      const irregular = groups.find((g) => g.title === "Irregular");
      if (irregular) {
        for (const r of irregular.examples) {
          // SAK-172: 〜歳's はたち row (二十歳, count 20) is an EXTRA suppletive
          // row appended beyond the 1-10 sweep counterIrregulars() models — it
          // is irregular by definition (a whole different word), not because
          // some digit d in 1-10 shifted, so countOf/shifts cannot classify it.
          // Pinned separately in the dedicated describe block above.
          if (r.word === "二十歳") continue;
          // SAK-177: 円's extra 1000円/せんえん row (count 1000) is likewise
          // OUTSIDE the 1-10 sweep countOf/counterReading model.
          if (r.word === "千円") continue;
          assert.ok(shifts.has(countOf(r.word)), `${kind} ${r.word} should be irregular`);
        }
      }
    }
  });
});

// SAK-172: 二十歳/はたち no longer has a standalone Library page to LINK from —
// numberConstructionForCounterGlyph (SAK-35's join for that link) was removed
// as dead code alongside it (see number-construction.ts's note where the
// function used to live). はたち is now a genuine ROW on 〜歳's own page
// instead — pinned below, the same way day-of-month's page already pins
// 20日's suppletive はつか (day-month-construction.test.ts).
describe("〜歳's Irregular table carries 二十歳/はたち as a real row (SAK-172)", () => {
  const sai = () => numberConstructionRow("sai")!;
  const irregular = () => sai().exampleGroups.find((g) => g.title === "Irregular")!;

  test("the row exists, reads はたち, and is fully suppletive (no additive equation)", () => {
    const row = irregular().examples.find((r) => r.word === "二十歳");
    assert.ok(row, "〜歳's Irregular table must carry a 二十歳 row");
    assert.equal(row!.label, "20 years old");
    assert.equal(row!.reading, "はたち");
    assert.deepEqual(row!.build, [], "はたち is its own word, not 二十 + さい");
    assert.deepEqual(row!.result, { kana: "はたち", value: "20" });
  });

  test("it sits alongside the sound-shift irregulars 1/8/10, not in place of them", () => {
    const words = irregular().examples.map((r) => r.word);
    assert.deepEqual(words, ["一歳", "八歳", "十歳", "二十歳"]);
  });

  test("countGroupHasBuild is still true for 〜歳's Irregular group — the sound-shift rows still build", () => {
    // Mixed group: 一歳/八歳/十歳 build additively, 二十歳 does not. The column
    // stays because SOME row has a real derivation (see countGroupHasBuild's
    // own doc comment) — only an ALL-suppletive group (〜人's) drops it.
    assert.equal(countGroupHasBuild(irregular().examples), true);
  });
});

// SAK-177: 円 never shifts, so its 1-10 sweep is a single Regular table (no
// Irregular table exists to append to, unlike 〜歳's はたち above) — the extra
// worked example (1000円/せんえん, the real vocab.json duplicate this category
// dedups) is instead appended to the REGULAR table via CounterSpec's new
// `extraRegular`, computed straight from numberReading + 円's own base reading
// rather than through counterReading (which caps at 99).
describe("〜円's Regular table carries 1000円/せんえん as an extra worked row (SAK-177)", () => {
  const en = () => numberConstructionRow("en")!;
  const regular = () => en().exampleGroups.find((g) => g.title === "Regular")!;

  test("the row exists, reads せんえん, and builds additively (1000 is fully regular)", () => {
    const row = regular().examples.find((r) => r.word === "千円");
    assert.ok(row, "〜円's Regular table must carry a 千円 row");
    assert.equal(row!.label, "1000 yen");
    assert.equal(row!.reading, "せんえん");
    assert.equal(row!.reading, numberReading(1000) + "えん", "matches the engine directly");
    assert.deepEqual(row!.build, [{ kana: "せん", value: "1000" }, { kana: "えん" }]);
    assert.deepEqual(row!.result, { kana: "せんえん", value: "1000" });
  });

  test("it sits alongside the ordinary 1-10 sweep, not in place of it", () => {
    const words = regular().examples.map((r) => r.word);
    assert.deepEqual(words.slice(0, 10), [
      "一円", "二円", "三円", "四円", "五円", "六円", "七円", "八円", "九円", "十円",
    ]);
    assert.equal(words[10], "千円");
  });

  test("〜割 and 〜階 carry no such extra row — only 円 has a real big-number duplicate", () => {
    const wariRegular = numberConstructionRow("wari")!.exampleGroups.find((g) => g.title === "Regular")!;
    assert.equal(wariRegular.examples.length, 10);
    const floorGroups = numberConstructionRow("floor")!.exampleGroups;
    const floorRowCount = floorGroups.reduce((sum, g) => sum + g.examples.length, 0);
    assert.equal(floorRowCount, 10);
  });
});

// SAK-171: 〜時 (telling the hour) is a CLOSED range — 1-12, matching real
// Japanese clock hours — rather than the ordinary 1-10 table + up-to-99 quiz
// every OTHER counter here gets (see CounterSpec's `range` field). These pin
// the whole table the ticket specifies: 1,2,3,5,6,8,10,11,12 Regular;
// 4 (よじ), 7 (しちじ), 9 (くじ) Irregular — and that 11時/12時 (past the
// ordinary 1-10 sweep) spell correctly, the exact bug a single-digit lookup
// table would have hit silently (see number-construction.ts's counterRow).
describe("〜時's table is the CLOSED 1-12 range the ticket specifies (SAK-171)", () => {
  // countOf (above) reads only the FIRST kanji character, so it mis-parses a
  // two-character spelling like 十一 (11) as 10 — every OTHER counter's table
  // never reaches past 10, so that gap never showed up before. 〜時's own rows
  // parse their count off `label` ("11 o'clock") instead, which is exact at
  // any count.
  const nOf = (row: { label: string }) => Number.parseInt(row.label, 10);

  test("Regular carries exactly 1,2,3,5,6,8,10,11,12", () => {
    assert.deepEqual(rowsOf("ji", "Regular").map(nOf), [1, 2, 3, 5, 6, 8, 10, 11, 12]);
  });

  test("Irregular carries exactly 4, 7, 9 with the correct readings よじ/しちじ/くじ", () => {
    const irregular = rowsOf("ji", "Irregular");
    assert.deepEqual(irregular.map(nOf), [4, 7, 9]);
    assert.deepEqual(irregular.map((r) => r.reading), ["よじ", "しちじ", "くじ"]);
  });

  test("every row's reading is the engine's, never a re-spelling", () => {
    for (const title of ["Regular", "Irregular"] as const) {
      for (const row of rowsOf("ji", title)) {
        const n = nOf(row);
        assert.equal(row.reading, counterReading(n, "ji"), `count ${n}`);
      }
    }
  });

  test("11時/12時 spell correctly (十一時/十二時) — past the ordinary 1-10 sweep every other counter caps at", () => {
    const words = rowsOf("ji", "Regular").map((r) => r.word);
    assert.ok(words.includes("十一時"), "11時 must spell 十一時, not undefined時");
    assert.ok(words.includes("十二時"), "12時 must spell 十二時, not undefined時");
  });

  test("the Irregular rows show the naive number+じ equation, with the result carrying the true shift", () => {
    // Same teaching device every other sound-shift irregular row uses (see
    // counterRow's doc comment): the BUILD pieces are the naive number + base,
    // and the RESULT is the actual (branch-shifted) reading.
    const irregular = rowsOf("ji", "Irregular");
    const four = irregular.find((r) => nOf(r) === 4)!;
    assert.deepEqual(four.build, [{ kana: "よん", value: "4" }, { kana: "じ" }]);
    assert.deepEqual(four.result, { kana: "よじ", value: "4" });
    const seven = irregular.find((r) => nOf(r) === 7)!;
    assert.deepEqual(seven.build, [{ kana: "なな", value: "7" }, { kana: "じ" }]);
    assert.deepEqual(seven.result, { kana: "しちじ", value: "7" });
    const nine = irregular.find((r) => nOf(r) === 9)!;
    assert.deepEqual(nine.build, [{ kana: "きゅう", value: "9" }, { kana: "じ" }]);
    assert.deepEqual(nine.result, { kana: "くじ", value: "9" });
  });

  test("the 'Quiz me' round is capped at 12, never 99", () => {
    assert.equal(numberConstructionRow("ji")!.quizConfig!.numberMax, 12);
  });
});
