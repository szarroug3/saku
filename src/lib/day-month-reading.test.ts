// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/day-month-reading.test.ts
//
// day-month-reading.ts is the pure engine behind the 〜日/〜月 "how it's built"
// reference page (src/data/day-month-construction.ts) AND, since SAK-163
// round 4, the generative "day"/"month" quiz round (number-quiz.ts's QuizKind).
// The cross-check block below is the correctness contract: it pins
// dayReading/monthReading to the real readings src/data/counters.ts's DAYS/
// MONTHS arrays ship (reference-only data now — see that file's header; these
// forms are no longer individually scheduled/drilled) — if a derived reading
// ever drifted from what the app actually teaches, this test would fail before
// a page could show it or a rolled quiz item could ask it.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DAYS, MONTHS } from "@/data/counters";
import {
  dayReading,
  dayReadingParts,
  isDayException,
  isMonthException,
  monthReading,
  monthReadingParts,
} from "@/lib/day-month-reading";

const DAY_FORMS = DAYS;
const MONTH_FORMS = MONTHS;

describe("cross-check against src/data/counters.ts's shipped DAYS/MONTHS forms", () => {
  test("counters.ts ships exactly 31 day forms and 12 month forms, in order 1..n", () => {
    assert.equal(DAY_FORMS.length, 31);
    assert.equal(MONTH_FORMS.length, 12);
  });

  test("dayReading(n) reproduces every one of the 31 shipped day readings", () => {
    DAY_FORMS.forEach((form, i) => {
      const n = i + 1;
      assert.equal(dayReading(n), form.reading, `day ${n} (${form.glyph})`);
    });
  });

  test("monthReading(n) reproduces every one of the 12 shipped month readings", () => {
    MONTH_FORMS.forEach((form, i) => {
      const n = i + 1;
      assert.equal(monthReading(n), form.reading, `month ${n} (${form.glyph})`);
    });
  });

  test("dayReadingParts joins back to the exact same string dayReading returns", () => {
    for (let n = 1; n <= 31; n++) {
      const parts = dayReadingParts(n)!;
      assert.equal(parts.map((p) => p.kana).join(""), dayReading(n), `day ${n}`);
    }
  });

  test("monthReadingParts joins back to the exact same string monthReading returns", () => {
    for (let n = 1; n <= 12; n++) {
      const parts = monthReadingParts(n)!;
      assert.equal(parts.map((p) => p.kana).join(""), monthReading(n), `month ${n}`);
    }
  });
});

describe("out-of-range inputs", () => {
  test("day 0, 32 and non-integers are null", () => {
    assert.equal(dayReading(0), null);
    assert.equal(dayReading(32), null);
    assert.equal(dayReading(1.5), null);
    assert.equal(dayReadingParts(32), null);
  });

  test("month 0, 13 and non-integers are null", () => {
    assert.equal(monthReading(0), null);
    assert.equal(monthReading(13), null);
    assert.equal(monthReading(2.5), null);
    assert.equal(monthReadingParts(13), null);
  });
});

describe("isDayException — the ticket's named exceptions, PLUS the branch-digit ones it missed", () => {
  test("the 1st-10th are a memorised tier, not exceptions to a rule", () => {
    for (let n = 1; n <= 10; n++) assert.equal(isDayException(n), false, `day ${n}`);
  });

  test("exactly 14, 17, 19, 20, 24, 27, 29 break the plain [number]+にち pattern", () => {
    const exceptions = Array.from({ length: 21 }, (_, i) => i + 11).filter(isDayException);
    assert.deepEqual(exceptions, [14, 17, 19, 20, 24, 27, 29]);
  });

  test("every non-exception 11-31 day is the plain number plus にち", () => {
    for (let n = 11; n <= 31; n++) {
      if (isDayException(n)) continue;
      assert.equal(dayReading(n), `${numberReadingOf(n)}にち`, `day ${n}`);
    }
  });
});

describe("isMonthException — exactly 4, 7, 9", () => {
  test("only 4, 7 and 9 break the plain [number]+がつ pattern", () => {
    const exceptions = Array.from({ length: 12 }, (_, i) => i + 1).filter(isMonthException);
    assert.deepEqual(exceptions, [4, 7, 9]);
  });

  test("every non-exception month is the plain number plus がつ", () => {
    for (let n = 1; n <= 12; n++) {
      if (isMonthException(n)) continue;
      assert.equal(monthReading(n), `${numberReadingOf(n)}がつ`, `month ${n}`);
    }
  });
});

// A tiny local re-derivation of the plain number reading, independent of
// number-reading.ts's own export, so the "non-exception" tests above are not
// just calling the same function they are meant to be checking against. Valid
// for 1-31, which is all these tests ever pass it.
const ONES = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
function numberReadingOf(n: number): string {
  if (n <= 10) return n === 10 ? "じゅう" : ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return (tens === 1 ? "じゅう" : ONES[tens] + "じゅう") + (ones === 0 ? "" : ONES[ones]);
}
