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

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildNumberRound,
  counterIrregulars,
  gradeNumberItem,
  type NumberQuizConfig,
  type NumberQuizItem,
} from "./number-quiz.ts";
import {
  acceptableCounterReadings,
  acceptableNumberReadings,
  counterReading,
  numberReading,
  type CounterKind,
} from "@/lib/number-reading";

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
      if (it.counter) {
        assert.equal(counterReading(it.n, it.counter), it.reading);
      }
    }
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
        }
      : {
          kind: "number",
          n,
          counter: null,
          direction: "read",
          reading: numberReading(n),
          accept: acceptableNumberReadings(n),
          digits: String(n),
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
    };
    assert.ok(gradeNumberItem(item, "3"));
    assert.ok(gradeNumberItem(item, "３")); // full-width
    assert.ok(!gradeNumberItem(item, "4"));
    // The reading is NOT accepted — HEAR wants the count, not the kana.
    assert.ok(!gradeNumberItem(item, "さんぼん"));
  });
});
