// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/audit-numbers.test.ts
//
// EXPANDED CORRECTNESS AUDIT for the number/counter reading engine
// (src/lib/number-reading.ts). This is a SEPARATE guard from
// number-reading.test.ts (which pins the fixtures and cross-checks the shipped
// counters.ts). Here every expected string is HAND-WRITTEN correct Japanese —
// the table is the independent gold standard, not a mirror of the engine — so a
// drift in the engine is caught against reality, not against itself.
//
// It exists because the shipped cross-check only covers counts the curriculum
// still ships as rote forms; the generative "Quiz me" rounds draw counts the
// curriculum never lists (11本, 21人, 66匹 …), and those readings had no guard.
// The 〜人 rows in particular pin the suppletive-composition rule — 11人 is
// じゅういちにん, never じゅうひとり — the bug this audit found and fixed.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  acceptableCounterReadings,
  acceptableNumberReadings,
  counterReading,
  numberReading,
  type CounterKind,
} from "@/lib/number-reading";

// ─── BARE NUMBERS ────────────────────────────────────────────────────────────
// Every sound-shift point, every 万-seam, and a spread of plain values across
// 1–99,999. Each expected reading is correct standard Japanese.
describe("numberReading — full-range pinned table", () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    // ones 1–9
    [1, "いち"], [2, "に"], [3, "さん"], [4, "よん"], [5, "ご"],
    [6, "ろく"], [7, "なな"], [8, "はち"], [9, "きゅう"],
    // tens: the multiplier never branches (40 is よんじゅう, not しじゅう)
    [10, "じゅう"], [11, "じゅういち"], [12, "じゅうに"], [19, "じゅうきゅう"],
    [20, "にじゅう"], [40, "よんじゅう"], [70, "ななじゅう"], [90, "きゅうじゅう"],
    [48, "よんじゅうはち"], [99, "きゅうじゅうきゅう"],
    // hundreds — the four shifts (3 びゃく, 6 ぴゃく, 8 ぴゃく) and the regulars
    [100, "ひゃく"], [200, "にひゃく"], [300, "さんびゃく"], [400, "よんひゃく"],
    [500, "ごひゃく"], [600, "ろっぴゃく"], [700, "ななひゃく"], [800, "はっぴゃく"],
    [900, "きゅうひゃく"],
    [101, "ひゃくいち"], [306, "さんびゃくろく"], [380, "さんびゃくはちじゅう"],
    [618, "ろっぴゃくじゅうはち"], [888, "はっぴゃくはちじゅうはち"],
    [999, "きゅうひゃくきゅうじゅうきゅう"],
    // thousands — the shifts (3 ぜん, 8 はっせん) and the regulars
    [1000, "せん"], [2000, "にせん"], [3000, "さんぜん"], [4000, "よんせん"],
    [5000, "ごせん"], [6000, "ろくせん"], [7000, "ななせん"], [8000, "はっせん"],
    [9000, "きゅうせん"],
    [1001, "せんいち"], [1234, "せんにひゃくさんじゅうよん"],
    [3300, "さんぜんさんびゃく"], [8800, "はっせんはっぴゃく"],
    // 万 seams — 万 keeps its 1 (いちまん), and the grouping stitches cleanly
    [10000, "いちまん"], [10001, "いちまんいち"], [10005, "いちまんご"],
    [12500, "いちまんにせんごひゃく"], [20000, "にまん"], [20300, "にまんさんびゃく"],
    [30000, "さんまん"], [80000, "はちまん"],
    [100000, "じゅうまん"], // 10万 — the tens multiply the 万
    [99999, "きゅうまんきゅうせんきゅうひゃくきゅうじゅうきゅう"],
  ];

  for (const [n, expected] of cases) {
    test(`${n} → ${expected}`, () => {
      assert.equal(numberReading(n), expected);
    });
  }
});

// The ones-digit branch readings (4 し, 7 しち, 9 く) are accepted only on the
// FINAL ones digit, never on a tens/hundreds multiplier.
describe("acceptableNumberReadings — branch alternates", () => {
  const cases: ReadonlyArray<readonly [number, readonly string[]]> = [
    [4, ["よん", "し"]],
    [7, ["なな", "しち"]],
    [9, ["きゅう", "く"]],
    [24, ["にじゅうよん", "にじゅうし"]],
    [99, ["きゅうじゅうきゅう", "きゅうじゅうく"]], // ones 9 branches to く
    [109, ["ひゃくきゅう", "ひゃくく"]],
    [40, ["よんじゅう"]], // multiplier does not branch
    [400, ["よんひゃく"]],
    [700, ["ななひゃく"]],
    [1, ["いち"]],
  ];
  for (const [n, expected] of cases) {
    test(`${n} accepts ${expected.join(" / ")}`, () => {
      assert.deepEqual(acceptableNumberReadings(n), [...expected]);
    });
  }
});

// ─── COUNTERS 1–10 ───────────────────────────────────────────────────────────
// The whole low-count table for every counter the app teaches, pinned to correct
// Japanese: は-row hardening (本/匹/杯), か/さ-row gemination (個/冊/回/歳/杯),
// the clean counters (枚/台), and the 〜人/〜つ irregulars.
describe("counterReading — every counter, counts 1–10", () => {
  const TABLE: Record<CounterKind, readonly string[]> = {
    // native series — pure memorisation, valid only 1–10
    tsu: ["ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ", "むっつ", "ななつ", "やっつ", "ここのつ", "とお"],
    // people — 1/2/4 suppletive, rest plain + にん
    nin: ["ひとり", "ふたり", "さんにん", "よにん", "ごにん", "ろくにん", "しちにん", "はちにん", "きゅうにん", "じゅうにん"],
    // は-row hardening: っ+ぽん at 1/6/8/10, voicing ぼん at 3
    hon: ["いっぽん", "にほん", "さんぼん", "よんほん", "ごほん", "ろっぽん", "ななほん", "はっぽん", "きゅうほん", "じゅっぽん"],
    // は-row hardening: っ+ぴき at 1/6/8/10, voicing びき at 3
    hiki: ["いっぴき", "にひき", "さんびき", "よんひき", "ごひき", "ろっぴき", "ななひき", "はっぴき", "きゅうひき", "じゅっぴき"],
    // clean — no shift at all
    mai: ["いちまい", "にまい", "さんまい", "よんまい", "ごまい", "ろくまい", "ななまい", "はちまい", "きゅうまい", "じゅうまい"],
    // か-row gemination at 1/6/8/10
    ko: ["いっこ", "にこ", "さんこ", "よんこ", "ごこ", "ろっこ", "ななこ", "はっこ", "きゅうこ", "じゅっこ"],
    // clean
    dai: ["いちだい", "にだい", "さんだい", "よんだい", "ごだい", "ろくだい", "ななだい", "はちだい", "きゅうだい", "じゅうだい"],
    // さ-row gemination at 1/8/10 (no shift at 6 — ろくさつ)
    satsu: ["いっさつ", "にさつ", "さんさつ", "よんさつ", "ごさつ", "ろくさつ", "ななさつ", "はっさつ", "きゅうさつ", "じゅっさつ"],
    // は-row hardening: っ+ぱい at 1/6/8/10, voicing ばい at 3
    hai: ["いっぱい", "にはい", "さんばい", "よんはい", "ごはい", "ろっぱい", "ななはい", "はっぱい", "きゅうはい", "じゅっぱい"],
    // か-row gemination at 1/6/8/10
    kai: ["いっかい", "にかい", "さんかい", "よんかい", "ごかい", "ろっかい", "ななかい", "はっかい", "きゅうかい", "じゅっかい"],
    // さ-row gemination at 1/8/10 (no shift at 6 — ろくさい)
    sai: ["いっさい", "にさい", "さんさい", "よんさい", "ごさい", "ろくさい", "ななさい", "はっさい", "きゅうさい", "じゅっさい"],
  };

  for (const kind of Object.keys(TABLE) as CounterKind[]) {
    for (let n = 1; n <= 10; n++) {
      const expected = TABLE[kind][n - 1];
      test(`(${n}, ${kind}) → ${expected}`, () => {
        assert.equal(counterReading(n, kind), expected);
      });
    }
  }
});

// ─── COUNTERS, HIGHER COUNTS (11–99) ─────────────────────────────────────────
// The compound rule: tens prefix + the ones-place counted form. Pinned across
// every shift class and both compound branches (ones ≠ 0 and ones = 0).
describe("counterReading — compound counts 11–99", () => {
  const cases: ReadonlyArray<readonly [number, CounterKind, string]> = [
    // 〜人 — THE suppletive-composition guard. 1/2 do NOT compose; 4 does.
    [11, "nin", "じゅういちにん"], // NOT じゅうひとり
    [12, "nin", "じゅうににん"], //  NOT じゅうふたり
    [14, "nin", "じゅうよにん"], //  四人 holds at every scale
    [20, "nin", "にじゅうにん"],
    [21, "nin", "にじゅういちにん"],
    [22, "nin", "にじゅうににん"],
    [24, "nin", "にじゅうよにん"],
    [91, "nin", "きゅうじゅういちにん"],
    [99, "nin", "きゅうじゅうきゅうにん"],
    // 〜本 — hardening rides the ones place; the tens can geminate at ×10
    [11, "hon", "じゅういっぽん"],
    [13, "hon", "じゅうさんぼん"],
    [16, "hon", "じゅうろっぽん"],
    [20, "hon", "にじゅっぽん"],
    [23, "hon", "にじゅうさんぼん"],
    [66, "hon", "ろくじゅうろっぽん"],
    [88, "hon", "はちじゅうはっぽん"],
    [99, "hon", "きゅうじゅうきゅうほん"],
    // 〜匹
    [11, "hiki", "じゅういっぴき"],
    [30, "hiki", "さんじゅっぴき"],
    [66, "hiki", "ろくじゅうろっぴき"],
    // 〜杯
    [18, "hai", "じゅうはっぱい"],
    [40, "hai", "よんじゅっぱい"],
    [63, "hai", "ろくじゅうさんばい"],
    // 〜回 / 〜個 / 〜冊 / 〜歳 — か/さ gemination at ×10 and at ones 1/6/8
    [30, "kai", "さんじゅっかい"],
    [58, "kai", "ごじゅうはっかい"],
    [40, "ko", "よんじゅっこ"],
    [26, "ko", "にじゅうろっこ"],
    [20, "satsu", "にじゅっさつ"],
    [38, "satsu", "さんじゅうはっさつ"],
    [50, "sai", "ごじゅっさい"],
    [78, "sai", "ななじゅうはっさい"],
    // clean counters compose with zero surprises
    [23, "mai", "にじゅうさんまい"],
    [40, "mai", "よんじゅうまい"],
    [47, "dai", "よんじゅうななだい"],
    [90, "dai", "きゅうじゅうだい"],
  ];
  for (const [n, kind, expected] of cases) {
    test(`(${n}, ${kind}) → ${expected}`, () => {
      assert.equal(counterReading(n, kind), expected);
    });
  }
});

// ─── RANGE GUARDS ────────────────────────────────────────────────────────────
describe("counterReading — range boundaries", () => {
  test("tsu is 1–10 only", () => {
    assert.equal(counterReading(10, "tsu"), "とお");
    assert.equal(counterReading(11, "tsu"), null);
  });
  test("other counters are 1–99", () => {
    assert.equal(counterReading(99, "hon"), "きゅうじゅうきゅうほん");
    assert.equal(counterReading(100, "hon"), null);
  });
  test("below 1 is null", () => {
    assert.equal(counterReading(0, "mai"), null);
    assert.equal(counterReading(-3, "nin"), null);
  });
});

// The compound 〜人 forms carry the same しちにん↔ななにん alternate on their
// 7-based ones place, and no spurious ひとり/ふたり alternate.
describe("acceptableCounterReadings — 〜人 compound alternates", () => {
  test("17人 accepts しち and なな on the ones", () => {
    assert.deepEqual(acceptableCounterReadings(17, "nin"), [
      "じゅうしちにん",
      "じゅうななにん",
    ]);
  });
  test("11人 has one reading, じゅういちにん", () => {
    assert.deepEqual(acceptableCounterReadings(11, "nin"), ["じゅういちにん"]);
  });
  test("20本 offers じゅっ↔じっ", () => {
    assert.deepEqual(acceptableCounterReadings(20, "hon"), ["にじゅっぽん", "にじっぽん"]);
  });
});
