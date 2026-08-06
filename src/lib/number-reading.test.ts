// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/number-reading.test.ts
//
// number-reading.ts is the pure kana-reading engine for the number-reading
// quiz. The fixtures below are the correctness contract; the cross-check block
// pins the UNIT table to the readings src/data/counters.ts already ships and the
// app has verified — if a UNIT reading drifts from counters.ts, that test fails.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { COUNTER_CURRICULUM } from "@/data/counters";
import type { CounterForm } from "@/data/counters";
import {
  acceptableCounterReadings,
  acceptableNumberReadings,
  counterReading,
  numberReading,
} from "@/lib/number-reading";
import type { CounterKind } from "@/lib/number-reading";

describe("numberReading — bare number fixtures", () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [1, "いち"],
    [4, "よん"],
    [7, "なな"],
    [9, "きゅう"],
    [10, "じゅう"],
    [11, "じゅういち"],
    [14, "じゅうよん"],
    [19, "じゅうきゅう"],
    [20, "にじゅう"],
    [21, "にじゅういち"],
    [30, "さんじゅう"],
    [47, "よんじゅうなな"],
    [99, "きゅうじゅうきゅう"],
    [100, "ひゃく"],
    [101, "ひゃくいち"],
    [200, "にひゃく"],
    [300, "さんびゃく"],
    [380, "さんびゃくはちじゅう"],
    [600, "ろっぴゃく"],
    [800, "はっぴゃく"],
    [999, "きゅうひゃくきゅうじゅうきゅう"],
    [1000, "せん"],
    [1234, "せんにひゃくさんじゅうよん"],
    [3000, "さんぜん"],
    [8000, "はっせん"],
    [10000, "いちまん"],
    [12500, "いちまんにせんごひゃく"],
    [30000, "さんまん"],
    [100000, "じゅうまん"],
    [1000000, "ひゃくまん"],
    [99999, "きゅうまんきゅうせんきゅうひゃくきゅうじゅうきゅう"],
    [10005, "いちまんご"],
  ];

  for (const [n, expected] of cases) {
    test(`${n} → ${expected}`, () => {
      assert.equal(numberReading(n), expected);
    });
  }
});

describe("counterReading — counted-form fixtures", () => {
  const cases: ReadonlyArray<readonly [number, CounterKind, string | null]> = [
    [3, "hon", "さんぼん"],
    [11, "hon", "じゅういっぽん"],
    [20, "hon", "にじゅっぽん"],
    [23, "hon", "にじゅうさんぼん"],
    [99, "hon", "きゅうじゅうきゅうほん"],
    [4, "nin", "よにん"],
    [14, "nin", "じゅうよにん"],
    [20, "nin", "にじゅうにん"],
    [6, "hiki", "ろっぴき"],
    [30, "kai", "さんじゅっかい"],
    [8, "hai", "はっぱい"],
    [10, "tsu", "とお"],
    [11, "tsu", null],
    [100, "hon", null],
  ];

  for (const [n, counter, expected] of cases) {
    test(`(${n}, ${counter}) → ${expected}`, () => {
      assert.equal(counterReading(n, counter), expected);
    });
  }

  test("out-of-range guards", () => {
    assert.equal(counterReading(0, "hon"), null);
    assert.equal(counterReading(0, "tsu"), null);
    assert.equal(counterReading(-1, "mai"), null);
    assert.equal(counterReading(100, "kai"), null);
  });
});

describe("acceptableNumberReadings — branch alternates on the ones digit only", () => {
  test("isolated ones get し / しち / く", () => {
    assert.deepEqual(acceptableNumberReadings(4), ["よん", "し"]);
    assert.deepEqual(acceptableNumberReadings(7), ["なな", "しち"]);
    assert.deepEqual(acceptableNumberReadings(9), ["きゅう", "く"]);
  });

  test("branch applies to the final ones digit of a compound", () => {
    assert.deepEqual(acceptableNumberReadings(24), ["にじゅうよん", "にじゅうし"]);
    assert.deepEqual(acceptableNumberReadings(47), ["よんじゅうなな", "よんじゅうしち"]);
  });

  test("tens/hundreds multipliers do NOT branch — 40 is よんじゅう only", () => {
    assert.deepEqual(acceptableNumberReadings(40), ["よんじゅう"]);
    assert.deepEqual(acceptableNumberReadings(400), ["よんひゃく"]);
    assert.deepEqual(acceptableNumberReadings(70), ["ななじゅう"]);
  });

  test("no alternate → single-element array", () => {
    assert.deepEqual(acceptableNumberReadings(1), ["いち"]);
    assert.deepEqual(acceptableNumberReadings(10), ["じゅう"]);
    assert.deepEqual(acceptableNumberReadings(23), ["にじゅうさん"]);
  });
});

describe("acceptableCounterReadings — じゅっ↔じっ and 7人 alternates", () => {
  test("じゅっ → じっ variant", () => {
    assert.deepEqual(acceptableCounterReadings(10, "hon"), ["じゅっぽん", "じっぽん"]);
    assert.deepEqual(acceptableCounterReadings(30, "kai"), [
      "さんじゅっかい",
      "さんじっかい",
    ]);
    assert.deepEqual(acceptableCounterReadings(20, "hon"), ["にじゅっぽん", "にじっぽん"]);
  });

  test("7人 accepts しちにん and ななにん", () => {
    assert.deepEqual(acceptableCounterReadings(7, "nin"), ["しちにん", "ななにん"]);
    assert.deepEqual(acceptableCounterReadings(17, "nin"), [
      "じゅうしちにん",
      "じゅうななにん",
    ]);
  });

  test("no alternate → single element", () => {
    assert.deepEqual(acceptableCounterReadings(3, "hon"), ["さんぼん"]);
    assert.deepEqual(acceptableCounterReadings(4, "nin"), ["よにん"]);
  });

  test("null reading → empty array", () => {
    assert.deepEqual(acceptableCounterReadings(11, "tsu"), []);
    assert.deepEqual(acceptableCounterReadings(100, "hon"), []);
  });
});

// ─── CROSS-CHECK: pin the UNIT table to the shipped counters.ts readings ─────
// The counters curriculum keys are `counter:<kind>:<n>`. For every form the app
// ships, counterReading(n, kind) must equal that form's stored reading.
describe("cross-check against src/data/counters.ts", () => {
  const KEY_KIND: Record<string, CounterKind> = {
    tsu: "tsu",
    nin: "nin",
    hon: "hon",
    hiki: "hiki",
    mai: "mai",
    ko: "ko",
    dai: "dai",
    satsu: "satsu",
    hai: "hai",
    kai: "kai",
    sai: "sai",
  };

  // Parse `counter:<kind>:<n>` → [kind, n]. Numbers track (counter:num:*) and
  // the はたち irregular (counter:sai:20, a special reading this engine does not
  // model) are skipped — the engine only claims the regular counted forms.
  function parse(form: CounterForm): { kind: CounterKind; n: number } | null {
    const m = /^counter:([a-z]+):(\d+)$/.exec(form.key);
    if (!m) return null;
    const kindKey = m[1];
    const n = Number(m[2]);
    if (kindKey === "num") return null; // bare numbers, not a counted form
    if (kindKey === "sai" && n === 20) return null; // はたち, irregular
    const kind = KEY_KIND[kindKey];
    if (kind === undefined) return null;
    return { kind, n };
  }

  const checked = COUNTER_CURRICULUM.map(parse).filter(
    (x): x is { kind: CounterKind; n: number } => x !== null,
  );

  test("every shipped counted form is reproduced", () => {
    assert.ok(checked.length > 0, "expected some forms to cross-check");
    for (const form of COUNTER_CURRICULUM) {
      const p = parse(form);
      if (p === null) continue;
      assert.equal(
        counterReading(p.n, p.kind),
        form.reading,
        `${form.key} (${form.glyph}) expected ${form.reading}`,
      );
    }
  });
});
