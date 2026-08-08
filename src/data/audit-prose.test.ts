// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/audit-prose.test.ts
//
// PROSE-AUDIT GUARDS. The teaching prose in phase-intros.ts embeds worked
// examples whose readings are checkable values: a number reading, or a counted
// form. This file pins those hand-authored readings against the reading engine
// (src/lib/number-reading.ts), so a prose example can never quietly state a
// reading the app itself does not compute. The prose header comments already
// claim these `examples` are "verified against number-reading.ts"; this makes
// that claim mechanical instead of a promise.
//
// Scope is deliberately narrow: only the number/counter cards, whose examples
// carry a numeral (`to` = "20", "1,000") or a kanji count (`from` = "一 + 本")
// that maps cleanly onto the engine. Everything else in the prose is human
// judgement and lives in the audit report, not here.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COUNTER_SOUND_CHANGE,
  NUMBERS_BIG,
  NUMBERS_COMPOSE,
  type IntroExample,
} from "./phase-intros.ts";
import { counterReading, numberReading, type CounterKind } from "../lib/number-reading.ts";

/** Kanji digit → value, for the counter examples' `from` ("一 + 本"). */
const KANJI_DIGIT: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** Counter kanji → the engine's CounterKind. */
const COUNTER_KIND: Record<string, CounterKind> = {
  本: "hon",
  匹: "hiki",
  枚: "mai",
  人: "nin",
  個: "ko",
};

/** Parse a number card's `to` numeral ("20", "1,000", "100,000") to an int. */
function numeralOf(to: string): number {
  const n = Number(to.replaceAll(",", ""));
  assert.ok(Number.isInteger(n) && n > 0, `example \`to\` is not a numeral: ${to}`);
  return n;
}

/** Parse a counter card's `from` ("一 + 本") into [value, counterKind]. */
function counterOf(from: string): [number, CounterKind] {
  const [numKanji, ctrKanji] = from.split("+").map((s) => s.trim());
  const value = KANJI_DIGIT[numKanji];
  const kind = COUNTER_KIND[ctrKanji];
  assert.ok(value !== undefined, `unknown number kanji in \`from\`: ${from}`);
  assert.ok(kind !== undefined, `unknown counter kanji in \`from\`: ${from}`);
  return [value, kind];
}

describe("number-card example readings match the engine", () => {
  for (const card of [NUMBERS_COMPOSE, NUMBERS_BIG]) {
    for (const ex of card.examples as readonly IntroExample[]) {
      test(`${card.id}: ${ex.to} → ${ex.reading}`, () => {
        assert.ok(ex.reading, `example is missing a reading: ${ex.to}`);
        const n = numeralOf(ex.to);
        assert.equal(
          ex.reading,
          numberReading(n),
          `prose says ${n} is "${ex.reading}", engine says "${numberReading(n)}"`,
        );
      });
    }
  }
});

describe("counter-sound-change example readings match the engine", () => {
  for (const ex of COUNTER_SOUND_CHANGE.examples as readonly IntroExample[]) {
    test(`${ex.from} → ${ex.reading}`, () => {
      assert.ok(ex.reading, `example is missing a reading: ${ex.from}`);
      const [n, kind] = counterOf(ex.from);
      assert.equal(
        ex.reading,
        counterReading(n, kind),
        `prose says ${ex.from} is "${ex.reading}", engine says "${counterReading(n, kind)}"`,
      );
    });
  }
});
