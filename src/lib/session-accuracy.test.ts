// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/session-accuracy.test.ts
//
// WHAT THIS PINS
// ==============
// The live accuracy pill used to punish you for practising. Its numerator was
// `firstTryCorrect === true ? 1 : 0` — one boolean per FACT, for the whole run
// — over a denominator of `seen`, which counts SHOWINGS. Two units in one
// ratio. A learner who answered perfectly every single time watched the number
// fall 100% → 50% → 33% → 25% as one fact came round again, and endless mode
// repeats facts by design, so the longer they practised the worse they looked.
//
// The first test below is that learner. It is the whole reason this file
// exists, and the arithmetic was moved out of drill-screen.tsx so it could be
// written: the runner has no JSX transform and cannot load a .tsx.

import assert from "node:assert/strict";
import { test } from "node:test";

import { firstTryShowings } from "@/lib/first-try";
import { poolSessionCounts, sessionAccuracy } from "@/lib/session-accuracy";
import type { FactId, FactSessionDetail, SessionStats } from "@/types";

const f = (s: string): FactId => s as FactId;

function detail(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount: 1,
    correct: 1,
    slow: 0,
    confused: {},
    ...over,
  };
}

/** One fact, shown `n` times, every showing nailed cold. */
function perfect(n: number): SessionStats {
  return {
    [f("a")]: detail({
      seen: n,
      firstTryCorrect: true,
      firstTryCount: n,
      correct: n,
    }),
  };
}

test("a perfect learner reads 100% however often a fact repeats", () => {
  // THE REGRESSION. Before the fix these read 100, 50, 20, 10.
  for (const n of [1, 2, 5, 10]) {
    assert.equal(
      sessionAccuracy(perfect(n), "firstTry"),
      100,
      `strict accuracy after ${n} perfect showing(s)`,
    );
    assert.equal(
      sessionAccuracy(perfect(n), "attempt"),
      100,
      `forgiving accuracy after ${n} perfect showing(s)`,
    );
  }
});

test("repetition does not move a perfect score at all", () => {
  // Same claim from the other side: the number is CONSTANT, not merely high.
  const scores = [1, 2, 3, 5, 8, 13, 21].map((n) =>
    sessionAccuracy(perfect(n), "firstTry"),
  );
  assert.deepEqual(new Set(scores), new Set([100]));
});

test("both sides of the ratio count showings", () => {
  // 4 showings, 3 nailed cold. The old code could only ever contribute 1 to
  // the numerator here and would have said 25%.
  const stats: SessionStats = {
    [f("a")]: detail({ seen: 4, firstTryCount: 3, correct: 4, misses: 1 }),
  };
  assert.equal(sessionAccuracy(stats, "firstTry"), 75);
  // Forgiving is the same denominator, a different pass mark.
  assert.equal(sessionAccuracy(stats, "attempt"), 100);
});

test("an imperfect learner is not flattered either", () => {
  // The fix must not simply push the number up. 10 showings, 0 first-try.
  const stats: SessionStats = {
    [f("a")]: detail({
      seen: 10,
      firstTryCorrect: false,
      firstTryCount: 0,
      correct: 10,
      misses: 10,
    }),
  };
  assert.equal(sessionAccuracy(stats, "firstTry"), 0);
  assert.equal(sessionAccuracy(stats, "attempt"), 100);
});

test("facts pool across the run, weighted by showings", () => {
  // 8 first-try showings out of 10 total, spread over two facts of very
  // different sizes — the pooled ratio is over showings, not an average of the
  // two facts' percentages (which would be 75%).
  const stats: SessionStats = {
    [f("a")]: detail({ seen: 8, firstTryCount: 8, correct: 8 }),
    [f("b")]: detail({ seen: 2, firstTryCount: 1, correct: 2, misses: 1 }),
  };
  assert.equal(sessionAccuracy(stats, "firstTry"), 90);
});

test("a fact still in flight is left out entirely", () => {
  // The card on screen must not drag the pill down before it's been answered.
  const stats: SessionStats = {
    [f("a")]: detail({ seen: 2, firstTryCount: 2, correct: 2 }),
    [f("b")]: detail({
      seen: 1,
      firstTryCorrect: null,
      firstTryCount: 0,
      correct: 0,
      everCorrect: false,
    }),
  };
  const counts = poolSessionCounts(stats);
  assert.equal(counts.seen, 2, "the unanswered showing is not in the pool");
  assert.equal(sessionAccuracy(stats, "firstTry"), 100);
});

test("nothing answered yet is null, not 0%", () => {
  assert.equal(sessionAccuracy({}, "firstTry"), null);
  assert.equal(
    sessionAccuracy(
      { [f("a")]: detail({ firstTryCorrect: null, firstTryCount: 0 }) },
      "firstTry",
    ),
    null,
  );
});

// ---------- the localStorage migration ----------
//
// The quiz snapshot is persisted to `kanaquiz-session` and restored with a bare
// JSON.parse — no normalising pass — so a run started before `firstTryCount`
// existed comes back without the field. `undefined + 1` is NaN, and a NaN would
// spread through every merge after it.

/** A stat as an OLD snapshot stored it: no `firstTryCount` at all. The cast is
 * the point — this shape is exactly what JSON.parse hands back. */
function legacy(over: Partial<FactSessionDetail> = {}): FactSessionDetail {
  const st = detail(over) as Partial<FactSessionDetail>;
  delete st.firstTryCount;
  return st as FactSessionDetail;
}

test("a pre-firstTryCount stat never yields NaN", () => {
  const stats: SessionStats = { [f("a")]: legacy({ seen: 3, correct: 3 }) };
  const counts = poolSessionCounts(stats);
  assert.ok(!Number.isNaN(counts.firstTry), "numerator is a number");
  const pct = sessionAccuracy(stats, "firstTry");
  assert.ok(pct !== null && !Number.isNaN(pct), "accuracy is a number");
});

test("an absent count is derived from the flag, reproducing the old value", () => {
  // The migration choice, pinned: derive, don't zero. A resumed session reads
  // what it read before the upgrade rather than dropping to 0%.
  assert.equal(firstTryShowings(legacy({ firstTryCorrect: true })), 1);
  assert.equal(firstTryShowings(legacy({ firstTryCorrect: false })), 0);
  assert.equal(firstTryShowings(legacy({ firstTryCorrect: null })), 0);
});

test("the derived estimate cannot exceed seen", () => {
  // firstTryCorrect is only non-null once a showing has resolved, so seen >= 1
  // wherever the estimate is 1 — the invariant holds through the migration.
  for (const seen of [1, 2, 10]) {
    const st = legacy({ seen, firstTryCorrect: true });
    assert.ok(firstTryShowings(st) <= st.seen);
  }
});

test("a present count always wins over the flag", () => {
  // Once the field exists it is the truth, including when it disagrees with
  // the flag: first showing missed (flag false), next four nailed.
  const st = detail({ seen: 5, firstTryCorrect: false, firstTryCount: 4 });
  assert.equal(firstTryShowings(st), 4);
  assert.equal(sessionAccuracy({ [f("a")]: st }, "firstTry"), 80);
});
