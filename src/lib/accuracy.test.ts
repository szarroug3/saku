// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/accuracy.test.ts
//
// accuracy.ts is the ONE definition of the number every ring, HUD and picker
// circle reads. The traps it exists to close are arithmetic, so they are pinned
// arithmetically here:
//
//   - a showing never answered right scores 0, NOT 100 (the legacy
//     seen/(seen+missed) bug);
//   - `missed` is never a denominator;
//   - an entry's accuracy is a mean of its facts' accuracies, an unpractised
//     fact left OUT rather than counted as 0.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  EMPTY_COUNTS,
  accuracyFor,
  accuracyOf,
  formatAccuracy,
  totalFor,
  volumeFor,
} from "@/lib/accuracy";
import type { CountsByFact } from "@/lib/accuracy";
import type { FactCounts, FactId } from "@/types";

const fid = (s: string) => s as unknown as FactId;

function counts(p: Partial<FactCounts>): FactCounts {
  return { ...EMPTY_COUNTS, ...p };
}

describe("accuracyOf — the two metrics over one fact's counts", () => {
  test("null when never seen — 'no data', not zero", () => {
    assert.equal(accuracyOf(EMPTY_COUNTS, "firstTry"), null);
    assert.equal(accuracyOf(EMPTY_COUNTS, "attempt"), null);
  });

  test("strict = firstTry / seen", () => {
    assert.equal(accuracyOf(counts({ seen: 4, firstTry: 3 }), "firstTry"), 75);
  });

  test("forgiving = correct / seen", () => {
    assert.equal(accuracyOf(counts({ seen: 4, correct: 3 }), "attempt"), 75);
  });

  test("a showing never answered right scores 0, not 100 (the legacy trap)", () => {
    // seen=1, correct=0, missed=2: the old seen/(seen+missed) reading would have
    // been a positive number; the honest reading is 0.
    const c = counts({ seen: 1, correct: 0, missed: 2 });
    assert.equal(accuracyOf(c, "attempt"), 0);
    assert.equal(accuracyOf(c, "firstTry"), 0);
  });

  test("`missed` never moves the number — it is not in either formula", () => {
    const a = accuracyOf(counts({ seen: 4, correct: 4, missed: 0 }), "attempt");
    const b = accuracyOf(counts({ seen: 4, correct: 4, missed: 99 }), "attempt");
    assert.equal(a, 100);
    assert.equal(b, 100);
  });

  test("clamped to 0..100 and rounded", () => {
    assert.equal(accuracyOf(counts({ seen: 3, correct: 1 }), "attempt"), 33);
    assert.equal(accuracyOf(counts({ seen: 3, correct: 2 }), "attempt"), 67);
  });
});

describe("totalFor — pooling counts over facts (a real, larger population)", () => {
  const history: CountsByFact = {
    facts: {
      [fid("hira-a")]: counts({ seen: 2, firstTry: 2, correct: 2, missed: 1, slow: 1 }),
      [fid("hira-i")]: counts({ seen: 3, firstTry: 1, correct: 2, missed: 4, slow: 0 }),
    } as Record<FactId, FactCounts>,
  };

  test("sums each count field across the named facts", () => {
    const t = totalFor(history, [fid("hira-a"), fid("hira-i")]);
    assert.deepEqual(t, { seen: 5, firstTry: 3, correct: 4, missed: 5, slow: 1 });
  });

  test("silently skips a fact with no counts", () => {
    const t = totalFor(history, [fid("hira-a"), fid("never-practised")]);
    assert.equal(t.seen, 2);
  });

  test("returns a FactCounts with no stability field to sum", () => {
    const t = totalFor(history, [fid("hira-a")]) as unknown as Record<string, unknown>;
    assert.equal("stability" in t, false);
  });
});

describe("accuracyFor / volumeFor — the pooled, comparable readings", () => {
  const history: CountsByFact = {
    facts: {
      [fid("hira-a")]: counts({ seen: 4, correct: 4, firstTry: 2 }),
      [fid("hira-i")]: counts({ seen: 4, correct: 2, firstTry: 2 }),
    } as Record<FactId, FactCounts>,
  };

  test("pooled forgiving accuracy is the ratio of the pooled counts, not a mean of ratios", () => {
    // (4+2) correct / (4+4) seen = 75 — NOT (100 + 50)/2 = 75 by luck; make them
    // differ: below the mean-of-ratios would be 75 too, so use uneven seen.
    const uneven: CountsByFact = {
      facts: {
        [fid("a")]: counts({ seen: 1, correct: 1 }), // 100%
        [fid("b")]: counts({ seen: 3, correct: 0 }), // 0%
      } as Record<FactId, FactCounts>,
    };
    // pooled: 1/4 = 25.  mean of ratios: (100 + 0)/2 = 50.  The pool is the truth.
    assert.equal(accuracyFor(uneven, [fid("a"), fid("b")], "attempt"), 25);
    assert.equal(accuracyFor(history, [fid("hira-a"), fid("hira-i")], "attempt"), 75);
  });

  test("null when none of the facts was ever practised", () => {
    assert.equal(accuracyFor(history, [fid("nope")], "attempt"), null);
  });

  test("volumeFor is the pooled showings — a count, not a rate", () => {
    assert.equal(volumeFor(history, [fid("hira-a"), fid("hira-i")]), 8);
  });
});

describe("formatAccuracy — always carries the unit", () => {
  test("a percentage prints with %, null prints an em dash", () => {
    assert.equal(formatAccuracy(88), "88%");
    assert.equal(formatAccuracy(0), "0%");
    assert.equal(formatAccuracy(null), "—");
  });
});
