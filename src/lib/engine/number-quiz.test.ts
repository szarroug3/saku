// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/number-quiz.test.ts
//
// The procedural number-reading quiz makes no per-card facts, so what needs
// pinning is the ROUND SHAPE and the GRADER:
//   - a per-counter round of sufficient count contains EVERY irregular of that
//     counter (irregular-first is the whole point of the drill);
//   - ranges are respected (no bare n > numberMax, no counted n > 99, tsu never
//     appears unless configured);
//   - both directions are produced from a mixed config;
//   - the grader accepts a correct reading (kana AND a romaji spelling) and a
//     correct written count (ASCII and full-width digits), and rejects wrong;
//   - a seeded rng makes the round deterministic.
// SAK-163 round 4 adds "day"/"month" to the counters a round can roll — see the
// dedicated describe block below, which pins the same round-shape/grader
// contract against day-month-reading.ts's separate engine across the FULL
// 1-31 / 1-12 range.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildNumberRound,
  counterIrregulars,
  gradeNumberItem,
  makeItem,
  type NumberQuizConfig,
  type NumberQuizItem,
} from "./number-quiz.ts";
import {
  acceptableCounterReadings,
  acceptableNumberReadings,
  counterReading,
  countToKanji,
  numberReading,
  type CounterKind,
} from "@/lib/number-reading";
import {
  acceptableDayReadings,
  acceptableMonthReadings,
  dayReading,
  monthReading,
} from "@/lib/day-month-reading";
import { DAYS as dayForms, MONTHS as monthForms } from "@/data/counters";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ALL_COUNTERS: CounterKind[] = [
  "tsu",
  "nin",
  "hon",
  "hiki",
  "mai",
  "ko",
  "dai",
  "satsu",
  "hai",
  "kai",
  "sai",
];

describe("buildNumberRound — round shape", () => {
  test("a per-counter round contains every irregular of that counter", () => {
    for (const counter of ALL_COUNTERS) {
      const irregulars = counterIrregulars(counter);
      if (irregulars.length === 0) continue; // mai/dai are perfectly regular
      const cfg: NumberQuizConfig = {
        count: 60,
        includeCounters: true,
        counters: [counter],
        numberMax: 9999,
        directions: ["read", "write"],
      };
      const round = buildNumberRound(cfg, seeded(7));
      const present = new Set(
        round
          .filter((it) => it.counter === counter)
          .map((it) => it.n),
      );
      for (const k of irregulars) {
        assert.ok(
          present.has(k),
          `${counter} round is missing irregular ${k}`,
        );
      }
    }
  });

  test("ranges respected: bare ≤ numberMax, counted ≤ 99, tsu ≤ 10", () => {
    const cfg: NumberQuizConfig = {
      count: 80,
      includeCounters: true,
      counters: ALL_COUNTERS,
      numberMax: 999,
      directions: ["read", "write"],
    };
    const round = buildNumberRound(cfg, seeded(42));
    for (const it of round) {
      if (it.counter === null) {
        assert.ok(it.n >= 1 && it.n <= 999, `bare ${it.n} out of range`);
      } else if (it.counter === "tsu") {
        assert.ok(it.n >= 1 && it.n <= 10, `tsu ${it.n} out of range`);
      } else {
        assert.ok(it.n >= 1 && it.n <= 99, `counted ${it.n} out of range`);
      }
      // Every counted item must actually read (engine agrees it's in range).
      // This round's counters are all ordinary CounterKinds (ALL_COUNTERS has
      // no "day"/"month"), so a narrow-away guard is enough for the compiler;
      // day/month's own round-shape coverage lives in its own describe block
      // below, against day-month-reading.ts's dayReading/monthReading instead.
      if (it.counter && it.counter !== "day" && it.counter !== "month") {
        assert.equal(counterReading(it.n, it.counter), it.reading);
      }
    }
  });

  test("a counter-scoped round rolls ONLY counted items — never a bare number", () => {
    // The people-counter bug: a 〜人 round must attach 人 to every item ("17 人",
    // read じゅうしちにん), never show a bare "17". So a round scoped to a counter
    // yields only that counter's counted items, with no bare-number slots.
    for (const counter of ["nin", "hon", "mai", "sai"] as CounterKind[]) {
      const cfg: NumberQuizConfig = {
        count: 12,
        includeCounters: true,
        counters: [counter],
        numberMax: 99,
        directions: ["read", "write", "hear"],
      };
      const round = buildNumberRound(cfg, seeded(23));
      assert.ok(round.length > 0, `${counter} round is empty`);
      for (const it of round) {
        assert.equal(it.counter, counter, `${counter} round emitted a ${it.counter ?? "bare"} item`);
        assert.equal(it.kind, "counter");
      }
    }
  });

  test("a bare-number RANGE round still yields bare numbers (tens/big are correct)", () => {
    const cfg: NumberQuizConfig = {
      count: 12,
      includeCounters: false,
      counters: [],
      numberMax: 99,
      directions: ["read", "write", "hear"],
    };
    const round = buildNumberRound(cfg, seeded(23));
    assert.ok(round.every((it) => it.counter === null));
  });

  test("tsu is excluded from the default counter mix", () => {
    const cfg: NumberQuizConfig = {
      count: 40,
      includeCounters: true,
      counters: ["nin", "hon", "hiki", "mai", "ko", "dai"],
      numberMax: 9999,
      directions: ["read", "write"],
    };
    const round = buildNumberRound(cfg, seeded(3));
    assert.ok(round.every((it) => it.counter !== "tsu"));
  });

  test("both directions are produced from a mixed config", () => {
    const cfg: NumberQuizConfig = {
      count: 10,
      includeCounters: true,
      counters: ["hon", "hiki"],
      numberMax: 9999,
      directions: ["read", "write"],
    };
    const round = buildNumberRound(cfg, seeded(11));
    assert.ok(round.some((it) => it.direction === "read"));
    assert.ok(round.some((it) => it.direction === "write"));
  });

  test("all three directions are produced from a read/write/hear config", () => {
    const cfg: NumberQuizConfig = {
      count: 15,
      includeCounters: true,
      counters: ["hon", "hiki"],
      numberMax: 9999,
      directions: ["read", "write", "hear"],
    };
    const round = buildNumberRound(cfg, seeded(11));
    assert.ok(round.some((it) => it.direction === "read"));
    assert.ok(round.some((it) => it.direction === "write"));
    assert.ok(round.some((it) => it.direction === "hear"));
  });

  test("bare sound-shift anchors appear (300/600/800/3000/8000)", () => {
    const cfg: NumberQuizConfig = {
      count: 60,
      includeCounters: false,
      counters: [],
      numberMax: 9999,
      directions: ["read"],
    };
    const round = buildNumberRound(cfg, seeded(5));
    const bare = new Set(round.filter((it) => it.counter === null).map((it) => it.n));
    for (const v of [300, 600, 800, 3000, 8000]) {
      assert.ok(bare.has(v), `missing bare shift ${v}`);
    }
  });

  test("deterministic under a seeded rng", () => {
    const cfg: NumberQuizConfig = {
      count: 12,
      includeCounters: true,
      counters: ["nin", "hon"],
      numberMax: 9999,
      directions: ["read", "write"],
    };
    const a = buildNumberRound(cfg, seeded(99));
    const b = buildNumberRound(cfg, seeded(99));
    assert.deepEqual(a, b);
  });
});

// SAK-163 round 4: day-of-month (〜日) and month-of-year (〜月) are generative
// categories now, rolled through day-month-reading.ts's SEPARATE engine (see
// that file's header) rather than number-reading.ts's counterReading — but
// through the SAME QuizKind-dispatching makeItem/buildNumberRound every other
// counter uses. These pin that the round-shape guarantee (irregular-first
// coverage) and the readings/grading are correct across the FULL 1-31 / 1-12
// range, including every named exception.
describe("buildNumberRound — day/month (SAK-163 round 4)", () => {
  test("a day round of sufficient count contains every one of the 7 exceptions", () => {
    const cfg: NumberQuizConfig = {
      count: 31,
      includeCounters: true,
      counters: ["day"],
      numberMax: 31,
      directions: ["read", "write"],
    };
    const round = buildNumberRound(cfg, seeded(13));
    const present = new Set(round.map((it) => it.n));
    for (const k of [14, 17, 19, 20, 24, 27, 29]) {
      assert.ok(present.has(k), `day round is missing irregular ${k}`);
    }
  });

  test("a month round of sufficient count contains every one of the 3 exceptions", () => {
    const cfg: NumberQuizConfig = {
      count: 12,
      includeCounters: true,
      counters: ["month"],
      numberMax: 12,
      directions: ["read", "write"],
    };
    const round = buildNumberRound(cfg, seeded(13));
    const present = new Set(round.map((it) => it.n));
    for (const k of [4, 7, 9]) {
      assert.ok(present.has(k), `month round is missing irregular ${k}`);
    }
  });

  test("day items are capped at 31, never n=0 or n>31", () => {
    const cfg: NumberQuizConfig = {
      count: 60,
      includeCounters: true,
      counters: ["day"],
      numberMax: 999, // a generous cfg cap must still be clamped by counterMax
      directions: ["read", "write", "hear"],
    };
    const round = buildNumberRound(cfg, seeded(21));
    assert.ok(round.length > 0, "day round is empty");
    for (const it of round) {
      assert.equal(it.counter, "day");
      assert.ok(it.n >= 1 && it.n <= 31, `day ${it.n} out of range`);
      assert.equal(it.reading, dayReading(it.n), `day ${it.n} reading mismatch`);
    }
  });

  test("month items are capped at 12, never n=0 or n>12", () => {
    const cfg: NumberQuizConfig = {
      count: 30,
      includeCounters: true,
      counters: ["month"],
      numberMax: 999,
      directions: ["read", "write", "hear"],
    };
    const round = buildNumberRound(cfg, seeded(21));
    assert.ok(round.length > 0, "month round is empty");
    for (const it of round) {
      assert.equal(it.counter, "month");
      assert.ok(it.n >= 1 && it.n <= 12, `month ${it.n} out of range`);
      assert.equal(it.reading, monthReading(it.n), `month ${it.n} reading mismatch`);
    }
  });

  test("makeItem reproduces dayReading/monthReading for the FULL range, every direction", () => {
    for (let n = 1; n <= 31; n++) {
      for (const dir of ["read", "write", "hear"] as const) {
        const item = makeItem(n, "day", dir);
        assert.ok(item, `day ${n} (${dir}) should build`);
        assert.equal(item!.reading, dayReading(n), `day ${n} reading`);
        assert.deepEqual(item!.accept, acceptableDayReadings(n), `day ${n} accept set`);
        assert.equal(item!.digits, String(n));
        assert.equal(item!.promptKanji, dayForms[n - 1].glyph, `day ${n} promptKanji matches the shipped glyph`);
      }
    }
    for (let n = 1; n <= 12; n++) {
      for (const dir of ["read", "write", "hear"] as const) {
        const item = makeItem(n, "month", dir);
        assert.ok(item, `month ${n} (${dir}) should build`);
        assert.equal(item!.reading, monthReading(n), `month ${n} reading`);
        assert.deepEqual(item!.accept, acceptableMonthReadings(n), `month ${n} accept set`);
        assert.equal(item!.digits, String(n));
        assert.equal(item!.promptKanji, monthForms[n - 1].glyph, `month ${n} promptKanji matches the shipped glyph`);
      }
    }
  });

  test("makeItem refuses out-of-range day/month counts", () => {
    assert.equal(makeItem(0, "day", "read"), null);
    assert.equal(makeItem(32, "day", "read"), null);
    assert.equal(makeItem(0, "month", "read"), null);
    assert.equal(makeItem(13, "month", "read"), null);
  });

  test("gradeNumberItem grades a rolled day/month READ item correctly", () => {
    // 十四日 じゅうよっか — the よっか-reuse exception.
    const day14 = makeItem(14, "day", "read")!;
    assert.equal(day14.reading, "じゅうよっか");
    assert.ok(gradeNumberItem(day14, "じゅうよっか"));
    assert.ok(!gradeNumberItem(day14, "じゅうよんにち"));
    // 二十日 はつか — the fully suppletive exception.
    const day20 = makeItem(20, "day", "read")!;
    assert.equal(day20.reading, "はつか");
    assert.ok(gradeNumberItem(day20, "はつか"));
    // 七月 しちがつ — the branch-digit exception.
    const month7 = makeItem(7, "month", "read")!;
    assert.equal(month7.reading, "しちがつ");
    assert.ok(gradeNumberItem(month7, "しちがつ"));
    assert.ok(!gradeNumberItem(month7, "なながつ"));
  });

  test("gradeNumberItem grades a rolled day/month WRITE/HEAR item against digits", () => {
    const day20 = makeItem(20, "day", "write")!;
    assert.ok(gradeNumberItem(day20, "20"));
    assert.ok(gradeNumberItem(day20, "２０")); // full-width
    assert.ok(!gradeNumberItem(day20, "はつか"));
    const month7 = makeItem(7, "month", "hear")!;
    assert.ok(gradeNumberItem(month7, "7"));
    assert.ok(!gradeNumberItem(month7, "9"));
  });
});

describe("gradeNumberItem", () => {
  // Construct a READ item straight from the reading engine, so the grader test
  // controls exactly which value it grades (independent of round assembly).
  function readItem(n: number, counter: CounterKind | null): NumberQuizItem {
    return counter
      ? {
          kind: "counter",
          n,
          counter,
          direction: "read",
          reading: counterReading(n, counter) ?? "",
          accept: acceptableCounterReadings(n, counter),
          digits: String(n),
          promptKanji: countToKanji(n, counter),
        }
      : {
          kind: "number",
          n,
          counter: null,
          direction: "read",
          reading: numberReading(n),
          accept: acceptableNumberReadings(n),
          digits: String(n),
          promptKanji: countToKanji(n, null),
        };
  }

  test("accepts a correct reading typed as kana", () => {
    const item = readItem(47, null); // よんじゅうなな
    assert.equal(item.reading, "よんじゅうなな");
    assert.ok(gradeNumberItem(item, "よんじゅうなな"));
  });

  test("accepts a correct reading typed as romaji", () => {
    const item = readItem(47, null);
    assert.ok(gradeNumberItem(item, "yonjuunana"));
  });

  test("accepts a counter branch alternate (しち↔なな via engine set)", () => {
    const item = readItem(4, "nin"); // よにん
    assert.equal(item.reading, "よにん");
    assert.ok(gradeNumberItem(item, "yonin"));
  });

  test("rejects a wrong reading", () => {
    const item = readItem(47, null);
    assert.ok(!gradeNumberItem(item, "よんじゅうご"));
  });

  test("WRITE accepts ASCII and full-width digits, rejects wrong", () => {
    const item: NumberQuizItem = {
      kind: "counter",
      n: 3,
      counter: "hon",
      direction: "write",
      reading: "さんぼん",
      accept: [],
      digits: "3",
      promptKanji: "三本",
    };
    assert.ok(gradeNumberItem(item, "3"));
    assert.ok(gradeNumberItem(item, " 3 "));
    assert.ok(gradeNumberItem(item, "３")); // full-width
    assert.ok(!gradeNumberItem(item, "4"));
  });

  test("HEAR grades against digits, exactly like WRITE", () => {
    const item: NumberQuizItem = {
      kind: "counter",
      n: 3,
      counter: "hon",
      direction: "hear",
      reading: "さんぼん",
      accept: [],
      digits: "3",
      promptKanji: "三本",
    };
    assert.ok(gradeNumberItem(item, "3"));
    assert.ok(gradeNumberItem(item, "３")); // full-width
    assert.ok(!gradeNumberItem(item, "4"));
    // The reading is NOT accepted — HEAR wants the count, not the kana.
    assert.ok(!gradeNumberItem(item, "さんぼん"));
  });
});
