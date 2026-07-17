// Run: node --test src/lib/scoring.test.ts
//
// Uses node:test + native TypeScript stripping (Node 24). No test framework, no
// new dependencies — the same arrangement as confusions.test.ts, and it works
// for the same reason: scoring.ts imports only types, which stripping erases,
// so it loads here as the pure module it claims to be. If a future edit makes
// this file fail to load, that is the module having grown a dependency, and the
// import is the bug, not the test.
//
// WHAT THESE TESTS ARE FOR
// ========================
// THE CONSTANTS ARE PLACEHOLDERS (see scoring.ts). 2.3, 0.75 and the
// exponential are invented, and the whole rule is expected to be replaced by
// something fitted on real reviews. So a test that pins `stability === 2.3`
// would be a test of a guess — it would fail the day the model improves, and
// its failure would mean nothing.
//
// These test the SHAPE: the properties any replacement must also have, stated
// so that a swap has to keep them or say out loud that it doesn't. Where a
// number appears below it is almost always a RELATION (this > that, this is
// exactly 1.0, this is symmetric) rather than a value.
//
// The exception is `SCORING.gain` and friends, which appear by NAME. A test
// that says `1 + (SCORING.gain - 1) * 1` has only restated the implementation
// and cannot fail; a test that says "a hit at p→0 multiplies by more than a hit
// at p=0.5, and a hit at p=1 multiplies by exactly 1" is a claim about the
// model that survives any constant.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  rank,
  recall,
  review,
  SCORING,
  stateOf,
  status,
  statusAt,
  UNMET,
  weakness,
  type RankCandidate,
} from "./scoring.ts";
import type { FactId, FactState } from "../types/index.ts";

const DAY = 86_400_000;
/** An arbitrary "now". Nothing here reads a clock; this is just a fixed point
 * to measure from, and every test builds its own past relative to it. */
const T0 = Date.UTC(2026, 0, 1);

const id = (s: string) => s as FactId;

/** A state whose recall is exactly `p` at T0 — the inverse of `recall`.
 * Building states by the p they PRODUCE, rather than by stability-and-elapsed
 * and hoping, is what lets these tests talk about the model's shape instead of
 * about its arithmetic. */
function atRecall(p: number, stability = 10): FactState {
  return { stability, lastTested: T0 + stability * DAY * Math.log(p) };
}

/** How much one review multiplies stability by, at recall `p`. */
function factor(p: number, hit: boolean): number {
  const before = atRecall(p);
  const after = review(before, hit, T0);
  return after.stability / before.stability;
}

describe("recall", () => {
  test("is 1 the instant you are tested, and decays from there", () => {
    const s: FactState = { stability: 10, lastTested: T0 };
    assert.equal(recall(s, T0), 1);
    assert.ok(recall(s, T0 + DAY) < 1);
    assert.ok(recall(s, T0 + 5 * DAY) < recall(s, T0 + DAY));
  });

  test("is ~37% exactly `stability` days later — the definition of stability", () => {
    const s: FactState = { stability: 10, lastTested: T0 };
    assert.ok(Math.abs(recall(s, T0 + 10 * DAY) - 1 / Math.E) < 1e-9);
  });

  test("a bigger stability decays slower — the whole point of the number", () => {
    const weak: FactState = { stability: 2, lastTested: T0 };
    const strong: FactState = { stability: 60, lastTested: T0 };
    assert.ok(recall(strong, T0 + 30 * DAY) > recall(weak, T0 + 30 * DAY));
  });

  test("never exceeds 1, even if a session's clock ran backwards", () => {
    // Clock skew, an edited file, two machines. Elapsed clamps at 0 rather than
    // going negative — which would put p above 1 and make weakness NEGATIVE,
    // quietly sorting the fact below everything real.
    const s: FactState = { stability: 10, lastTested: T0 + 5 * DAY };
    assert.equal(recall(s, T0), 1);
    assert.ok(weakness(recall(s, T0)) >= 0);
  });
});

describe("weakness — the sort key", () => {
  test("PEAKS AT p = 0.5, and is zero at both ends", () => {
    // The thesis in one assertion. Not "you are worst at it" (p=0) and not
    // "you know it" (p=1) — the most useful question is the one the app can
    // least predict the answer to.
    assert.equal(weakness(0.5), 1);
    assert.equal(weakness(0), 0);
    assert.equal(weakness(1), 0);
    for (const p of [0.05, 0.2, 0.35, 0.45]) {
      assert.ok(weakness(p) < weakness(0.5), `weakness(${p}) < weakness(0.5)`);
      assert.ok(weakness(p) > weakness(p / 2), `rises toward 0.5 from below`);
    }
    for (const p of [0.55, 0.65, 0.8, 0.95]) {
      assert.ok(weakness(p) < weakness(0.5), `weakness(${p}) < weakness(0.5)`);
    }
  });

  test("is symmetric — the model learns as much from a likely miss as a likely hit", () => {
    for (const p of [0.1, 0.25, 0.4, 0.5]) {
      assert.ok(Math.abs(weakness(p) - weakness(1 - p)) < 1e-12);
    }
  });

  test("A FACT YOU FAIL EVERY TIME IS NOT THE TOP OF THE LIST", () => {
    // The old model's whole thesis, refuted. p→0 is not the most valuable
    // question — a question you would certainly fail teaches nothing that
    // reading the answer wouldn't.
    assert.ok(weakness(0.02) < weakness(0.5));
    assert.ok(weakness(0.02) < weakness(0.3));
  });
});

describe("the tails leave the ranking", () => {
  test("p → 1 is quiet, p → 0 is teach, the middle is the product", () => {
    assert.equal(statusAt(0.99), "quiet");
    assert.equal(statusAt(0.5), "probe");
    assert.equal(statusAt(0.01), "teach");
  });

  test("the two exits are DIFFERENT — a lost fact is not a known one", () => {
    // Both leave the ranking, and `weakness` alone cannot tell them apart
    // (it is symmetric — see above). If these ever collapse into one status,
    // the new-material budget loses the only signal that says which facts to
    // re-teach, and "you have lost it" starts being handled as "you know it".
    assert.notEqual(statusAt(0.99), statusAt(0.01));
    assert.ok(Math.abs(weakness(0.99) - weakness(0.01)) < 1e-3);
  });

  test("AN UNMET FACT AND A LOST FACT ARE THE SAME STATE", () => {
    // The cold-start rule and the p→0 rule are one rule, by arithmetic, with no
    // branch. An unmet fact has no strength; a fact at p≈0 has no strength
    // either. Both need teaching.
    assert.equal(status(UNMET, T0), "teach");
    assert.equal(recall(UNMET, T0), 0);
    const lost = atRecall(0.001);
    assert.equal(status(lost, T0), "teach");
  });

  test("stateOf reads a record with no state at all as unmet", () => {
    // An old history.json, or a fact whose evidence predates the model. Must
    // degrade to "teach everything", never to NaN.
    assert.deepEqual(stateOf(undefined), UNMET);
    assert.deepEqual(stateOf({}), UNMET);
    assert.equal(status(stateOf(undefined), T0), "teach");
    // And it must not trust a stored stability below the floor.
    assert.equal(stateOf({ stability: 0.001, lastTested: T0 }).stability, SCORING.floorDays);
    assert.ok(!Number.isNaN(recall(stateOf({ stability: 0 }), T0)));
  });
});

describe("review — one principle, both directions", () => {
  test("a hit is worth MORE the more surprising it is", () => {
    assert.ok(factor(0.1, true) > factor(0.5, true));
    assert.ok(factor(0.5, true) > factor(0.9, true));
  });

  test("a miss costs MORE the more surprising it is", () => {
    assert.ok(factor(0.9, false) < factor(0.5, false));
    assert.ok(factor(0.5, false) < factor(0.1, false));
  });

  test("MASSED REPETITION WRITES ×1.0, BY ARITHMETIC", () => {
    // Finish a drill, press "Redrill the misses", answer 30 seconds later.
    // p ≈ 1, so surpriseIfHit ≈ 0, so the multiplier is exactly 1. The
    // stability does not move — because answering a question you were asked
    // thirty seconds ago is not evidence about next week.
    //
    // NO SAME-DAY BRANCH ANYWHERE. This must stay a consequence of the (1-p)
    // gate, never a special case; the grep below is the guard.
    const after = review({ stability: 12, lastTested: T0 }, true, T0);
    assert.equal(after.stability, 12);

    // And ten of them in a row are still worth ~nothing, which is the property
    // that actually matters — a redrill loop cannot inflate a stability.
    //
    // "~nothing" and not "nothing": ten answers a second apart really are ten
    // seconds of elapsed time, so p is 0.999999 rather than 1 and the gate
    // multiplies by 1.0000012 rather than by 1. The drift is REAL and the model
    // is right to have it — the tolerance below is one part in 10,000 over ten
    // reps, i.e. the arithmetic conceding that a second passed and declining to
    // care.
    //
    // A same-day BRANCH would make this exactly 12, and would be worse: it
    // would need a definition of "same day" (whose midnight?), it would put a
    // cliff at that midnight where the model currently has a smooth curve, and
    // it would be a second, hidden rule about time sitting next to the real
    // one. There is no such branch in scoring.ts and there must never be — the
    // whole file's only notion of time is `elapsedDays`, a subtraction.
    let s: FactState = { stability: 12, lastTested: T0 };
    for (let i = 0; i < 10; i++) s = review(s, true, T0 + i * 1000);
    assert.ok(
      Math.abs(s.stability - 12) / 12 < 1e-4,
      `ten massed hits moved stability to ${s.stability}`,
    );
  });

  test("a massed MISS, by contrast, costs the maximum — same rule, read the other way", () => {
    const after = review({ stability: 12, lastTested: T0 }, false, T0);
    assert.ok(after.stability < 12);
    // Worst case keeps a fraction rather than zeroing: one miss is evidence,
    // not a reset.
    assert.ok(after.stability > 0);
    assert.equal(factor(1, false), 1 - SCORING.maxLoss);
  });

  test("a first MISS costs nothing — failing what you were never taught is not evidence", () => {
    const after = review(UNMET, false, T0);
    assert.equal(after.stability, UNMET.stability);
  });

  test("a first HIT earns the full gain — nothing is more surprising", () => {
    const after = review(UNMET, true, T0);
    assert.ok(after.stability > UNMET.stability);
    assert.equal(factor(0, true), SCORING.gain);
  });

  test("stability never falls below the floor, however many times you miss", () => {
    let s: FactState = { stability: 40, lastTested: T0 };
    for (let i = 0; i < 30; i++) s = review(s, false, T0 + i * DAY);
    assert.ok(s.stability >= SCORING.floorDays);
  });

  test("only evidence moves the clock, and it moves it to the evidence's time", () => {
    const when = T0 + 3 * DAY;
    assert.equal(review(UNMET, true, when).lastTested, when);
    assert.equal(review(UNMET, false, when).lastTested, when);
  });

  test("spaced hits compound; massed hits do not", () => {
    // Same number of correct answers, same total elapsed. The one that waited
    // learns something each time; the one that hammered learns once.
    let spaced: FactState = UNMET;
    for (let i = 0; i < 5; i++) {
      spaced = review(spaced, true, T0 + i * 30 * DAY);
    }
    let massed: FactState = UNMET;
    for (let i = 0; i < 5; i++) massed = review(massed, true, T0 + i * 1000);
    assert.ok(spaced.stability > massed.stability * 2);
  });
});

describe("rank — the drill list", () => {
  test("orders by expected surprise, and drops BOTH tails", () => {
    const facts: RankCandidate[] = [
      { id: id("known"), state: atRecall(0.98) },
      { id: id("mid"), state: atRecall(0.5) },
      { id: id("lost"), state: atRecall(0.005) },
      { id: id("nearly"), state: atRecall(0.75) },
      { id: id("unmet"), state: UNMET },
    ];
    assert.deepEqual(rank({ facts }, T0), [id("mid"), id("nearly")]);
  });

  test("THE THESIS: a 100%-accuracy fact 62 days cold RISES TO THE TOP", () => {
    // The case the old model structurally could not produce.
    //
    // `weakestFacts` ranked accuracy ascending. This fact has been answered
    // right every single time — 100% — so it sorted DEAD LAST, forever, and
    // 100% never rises. The one thing you are most likely to have forgotten was
    // the one thing the drill list could never surface.
    //
    // Here it is built the honest way: seven correct answers at widening
    // intervals, which is what earns a big stability, and then two months of
    // silence.
    let cold: FactState = UNMET;
    let at = T0;
    for (let i = 0; i < 7; i++) {
      cold = review(cold, true, at);
      // Space the NEXT review out to where this one decays to ~37%, which is
      // what a person who keeps getting it right looks like. Not after the
      // last one: `at` has to stay on the final review, or the 62 days below
      // would be 62 days on top of a gap the user never took.
      if (i < 6) at += cold.stability * DAY;
    }
    const now = at + 62 * DAY;

    // A fact you have drilled recently and get right about 80% of the time.
    const fresh: FactState = { stability: 20, lastTested: now - 2 * DAY };

    const order = rank(
      {
        facts: [
          { id: id("fresh"), state: fresh },
          { id: id("cold-100pct"), state: cold },
        ],
      },
      now,
    );
    assert.equal(order[0], id("cold-100pct"));

    // And it is genuinely in the probe band, not merely ahead of a bad rival:
    // the app has a real question to ask, and it cannot guess the answer.
    assert.equal(status(cold, now), "probe");
    assert.ok(recall(cold, now) > 0.3 && recall(cold, now) < 0.7);
  });

  test("A FACT MISSED 3× AND FLOORED DOES NOT SINK TO THE BOTTOM", () => {
    // Without the p→0 exit this is the model eating its own use case: miss
    // something three times, stability floors, p decays to ~0, 4·p·(1-p) goes
    // to ~0 with it, and the thing you are worst at in the entire app sorts
    // BELOW everything and becomes permanently unaskable — the more you miss
    // it, the deader it gets.
    let floored: FactState = { stability: 30, lastTested: T0 };
    let t = T0;
    for (let i = 0; i < 3; i++) {
      t += 2 * DAY;
      floored = review(floored, false, t);
    }
    // Three misses take 30 days of stability down to ~2 — a 93% collapse, but
    // NOT to the floor. Asserted as a collapse and not as `=== floorDays`
    // because the floor is not the point and the exact landing spot is a
    // property of two invented constants: reaching it takes about five misses
    // at these numbers, and a refit would move that. What must survive any
    // refit is that repeated misses destroy stability fast — and that doing so
    // does not bury the fact.
    assert.ok(floored.stability < 3, `three misses left ${floored.stability}d`);
    assert.ok(floored.stability >= SCORING.floorDays);

    // A day later it is not merely present, it is the BEST question in the app.
    const tomorrow = t + DAY;
    assert.equal(status(floored, tomorrow), "probe");
    const order = rank(
      {
        facts: [
          { id: id("solid"), state: { stability: 90, lastTested: tomorrow - 10 * DAY } },
          { id: id("floored"), state: floored },
        ],
      },
      tomorrow,
    );
    assert.equal(order[0], id("floored"));

    // Leave it a week and it is not ranked LOWER — it leaves, to be re-taught.
    // That is the rescue: it never sits at the bottom of a list being ignored.
    assert.equal(status(floored, t + 7 * DAY), "teach");
  });

  test("ties break toward the fact you are likelier to get wrong", () => {
    // weakness is symmetric, so p=0.3 and p=0.7 tie exactly. Real, not a
    // rounding accident. The model learns the same from either, so the tie is
    // its to spend.
    const facts: RankCandidate[] = [
      { id: id("likely-pass"), state: atRecall(0.7) },
      { id: id("likely-fail"), state: atRecall(0.3) },
    ];
    assert.deepEqual(rank({ facts }, T0), [id("likely-fail"), id("likely-pass")]);
  });

  test("is a total order — the list does not flicker between renders", () => {
    const facts: RankCandidate[] = [
      { id: id("b"), state: atRecall(0.5) },
      { id: id("a"), state: atRecall(0.5) },
      { id: id("c"), state: atRecall(0.5) },
    ];
    assert.deepEqual(rank({ facts }, T0), [id("a"), id("b"), id("c")]);
    assert.deepEqual(rank({ facts: [...facts].reverse() }, T0), [
      id("a"),
      id("b"),
      id("c"),
    ]);
  });

  test("limit caps the list; absent it returns everything worth asking", () => {
    const facts: RankCandidate[] = [
      { id: id("a"), state: atRecall(0.5) },
      { id: id("b"), state: atRecall(0.45) },
      { id: id("c"), state: atRecall(0.4) },
    ];
    assert.equal(rank({ facts, limit: 2 }, T0).length, 2);
    assert.equal(rank({ facts }, T0).length, 3);
    assert.deepEqual(rank({ facts: [] }, T0), []);
  });

  test("an all-quiet history ranks NOTHING — an empty list is a real answer", () => {
    // Right after drilling everything there is genuinely nothing worth asking,
    // and the selection empties and refills as time passes. The old accuracy
    // sort could never produce this, which is why the UI needs words for it:
    // they are now the start bar's ("You're solid on all of these for now"),
    // the weakness shelf that used to own them having gone with cfg.enabled.
    const facts: RankCandidate[] = [
      { id: id("a"), state: { stability: 30, lastTested: T0 } },
      { id: id("b"), state: { stability: 30, lastTested: T0 } },
    ];
    assert.deepEqual(rank({ facts }, T0), []);
  });
});

describe("the model is swappable", () => {
  test("its entire input is (stability, lastTested, now)", () => {
    // Not a history, not an accuracy, not a metric, not a deck. If this ever
    // needs more, the replacement rule stops being a drop-in and the module's
    // main promise is gone. Two states that are field-for-field equal must
    // rank, score and decay identically no matter what produced them.
    const a: FactState = { stability: 7, lastTested: T0 - 3 * DAY };
    const b: FactState = { stability: 7, lastTested: T0 - 3 * DAY };
    assert.equal(recall(a, T0), recall(b, T0));
    assert.equal(status(a, T0), status(b, T0));
    assert.deepEqual(review(a, true, T0), review(b, true, T0));
  });

  test("SCORING holds every number the model has", () => {
    // The table is the knob-set a future fit replaces. If a magic number
    // appears in the arithmetic instead of here, it is invisible to whoever
    // tunes this next.
    assert.deepEqual(Object.keys(SCORING).sort(), [
      "floorDays",
      "gain",
      "maxLoss",
      "quietAbove",
      "teachBelow",
    ]);
    assert.ok(SCORING.teachBelow < SCORING.quietAbove);
    assert.ok(SCORING.gain > 1, "a hit must be able to raise stability");
    assert.ok(
      SCORING.maxLoss > 0 && SCORING.maxLoss < 1,
      "a miss must lower stability without zeroing it",
    );
  });
});
