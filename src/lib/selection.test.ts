// Run: node --test --experimental-strip-types \
//        --import ./src/lib/conjugate/test-hooks.mjs src/lib/selection.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// resolve() is the "What to drill" screen's one function, and two of its
// behaviours are decisions a type-check cannot see:
//
//   1. An UN-NARROWED selection is everything you KNOW — the facts you've seen
//      or claimed — not the whole ~21,000-entry dictionary. Untaught material is
//      learned through the lesson loop (budget.ts), not drilled here. Day one,
//      when you know nothing, that pool is empty and that is correct.
//
//   2. The result is the whole named pool in RANDOM order, because this is a
//      review screen: the old "hardest first" sort drilled the same worst N in
//      the same order every time. resolve() no longer caps — the count is
//      Length's alone (budget.ts) — so it hands the budget the whole selection.
//      The weakness ranking still runs, but on the learning loop, never here.
//
// Both are asserted against the real kana data rather than a fixture: the thing
// under test is precisely that resolve() cuts the REAL registry the right way.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_FACTS } from "../data/characters.ts";
import { ALL_FACTS } from "./facts.ts";
import { effectiveState } from "./claims.ts";
import { status } from "./scoring.ts";
import {
  countOf,
  dueFacts,
  emptySelection,
  resolve,
  subjectWord,
} from "./selection.ts";
import type { FactAggregate, FactId, HistoryFile } from "../types/index.ts";

const NOW = Date.UTC(2026, 0, 15);
const KANA_IDS: FactId[] = KANA_FACTS.map((f) => f.id);

/** A fact the user has answered — `seen ≥ 1`, so it is in the knowledge base. */
function seen(over: Partial<FactAggregate> = {}): FactAggregate {
  return {
    seen: 4,
    missed: 0,
    firstTry: 4,
    correct: 4,
    stability: 10,
    lastTested: NOW,
    ...over,
  };
}

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/** A history in which exactly `ids` have been seen and nothing else. */
function knowing(ids: FactId[]): HistoryFile {
  return history({ facts: Object.fromEntries(ids.map((id) => [id, seen()])) });
}

describe('"Everything" is everything you KNOW, not the whole dictionary', () => {
  test("day one — an empty history names zero things", () => {
    const h = history();
    assert.equal(resolve(emptySelection(), h).length, 0);
    assert.equal(countOf(emptySelection(), h), 0);
  });

  test("the un-narrowed pool is your seen facts, not ALL_FACTS", () => {
    const known = KANA_IDS.slice(0, 3);
    const out = resolve(emptySelection(), knowing(known));
    assert.equal(out.length, 3);
    assert.deepEqual([...out].sort(), [...known].sort());
    // The whole dictionary is far larger — the pool must NOT be it.
    assert.ok(ALL_FACTS.length > 1000);
    assert.notEqual(out.length, ALL_FACTS.length);
  });

  test("untaught material is excluded — it is learned, not drilled here", () => {
    const known = KANA_IDS.slice(0, 3);
    const untaught = KANA_IDS[10];
    const out = new Set(resolve(emptySelection(), knowing(known)));
    assert.ok(!out.has(untaught));
  });

  test("a claimed-but-untested fact IS in the pool", () => {
    const claimed = KANA_IDS[5];
    const h = history({ claims: { [claimed]: NOW } });
    const out = resolve(emptySelection(), h);
    assert.deepEqual(out, [claimed]);
  });

  test("the New band still surfaces a genuinely-new-but-touched (claimed) fact", () => {
    const claimed = KANA_IDS[5];
    const h = history({ claims: { [claimed]: NOW } });
    const out = resolve({ ...emptySelection(), states: ["new"] }, h);
    assert.deepEqual(out, [claimed]);
  });
});

describe("the drill is the WHOLE pool in RANDOM order", () => {
  // resolve() no longer caps. "How many" was removed from the What-to-drill
  // card and the count is Length's alone (budget.ts); resolve hands the WHOLE
  // selection to the budget so it picks the session from everything you named.
  const pool = KANA_IDS.slice(0, 30);
  const h = knowing(pool);

  test("resolve returns the whole known pool — every fact, no duplicates", () => {
    const inPool = new Set(pool);
    const out = resolve(emptySelection(), h);
    assert.equal(out.length, pool.length);
    assert.equal(new Set(out).size, pool.length, "no duplicates");
    for (const f of out) assert.ok(inPool.has(f), "drawn from the pool");
    assert.deepEqual([...out].sort(), [...pool].sort());
  });

  test("the COUNT is stable across draws — it is the pool size", () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(countOf(emptySelection(), h), pool.length);
    }
  });

  test("the same query resolved twice gives a different order", () => {
    const seenOrderings = new Set<string>();
    for (let i = 0; i < 30; i++) {
      seenOrderings.add(resolve(emptySelection(), h).join(","));
    }
    // Identical orderings across 30 draws of a 30-fact pool is astronomically
    // unlikely — a deterministic (old "hardest first") resolve would produce
    // exactly one. More than one proves the order is random.
    assert.ok(seenOrderings.size > 1, "repeated drills must not be identical");
  });
});

describe("grammar is title-cased on the subject chip", () => {
  test('subjectWord("grammar") reads "Grammar", not the raw id', () => {
    assert.equal(subjectWord("grammar"), "Grammar");
  });
});

describe("the learned-date window narrows on history.learnedAt", () => {
  // Three known kana with distinct first-learned stamps. `knowing` puts them in
  // the pool (seen ≥ 1); `learnedAt` is set separately so we can test in/out.
  const [a, b, c] = KANA_IDS;
  const base = knowing([a, b, c]);
  const T_JAN = Date.UTC(2026, 0, 10);
  const T_FEB = Date.UTC(2026, 1, 10);
  const h: HistoryFile = {
    ...base,
    // c deliberately has NO learnedAt entry — an unknown first-learn.
    learnedAt: { [a]: T_JAN, [b]: T_FEB } as Record<FactId, number>,
  };

  test("includes only facts whose learnedAt is inside [from, to]", () => {
    const got = resolve(
      { ...emptySelection(), learned: { from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 0, 31) } },
      h,
    );
    assert.deepEqual(got.sort(), [a].sort(), "only the January fact");
  });

  test("a fact with no learnedAt is excluded when a window is active", () => {
    const got = resolve(
      { ...emptySelection(), learned: { from: Date.UTC(2025, 0, 1), to: Date.UTC(2027, 0, 1) } },
      h,
    );
    assert.ok(!got.includes(c), "the un-stamped fact is out");
    assert.deepEqual(got.sort(), [a, b].sort());
  });

  test("open-ended from-only includes everything at/after `from`", () => {
    const got = resolve(
      { ...emptySelection(), learned: { from: T_FEB, to: null } },
      h,
    );
    assert.deepEqual(got.sort(), [b].sort(), "only Feb (Jan is before)");
  });

  test("open-ended to-only includes everything at/before `to`", () => {
    const got = resolve(
      { ...emptySelection(), learned: { from: null, to: T_JAN } },
      h,
    );
    assert.deepEqual(got.sort(), [a].sort());
  });

  test("a backwards window (from after to) resolves to nothing, never everything", () => {
    // The Practice UI leaves From-after-To INVALID rather than swapping it (a
    // mid-edit swap would apply a range the learner never asked for), so this is
    // the safety net: a backwards window must name zero facts, not the whole
    // pool. No date can be both ≥ from and ≤ to when from > to.
    const got = resolve(
      { ...emptySelection(), learned: { from: T_FEB, to: T_JAN } },
      h,
    );
    assert.deepEqual(got, [], "backwards window is empty");
  });

  test("an absent/all-null window is no filter", () => {
    const all = resolve(emptySelection(), h).sort();
    assert.deepEqual(
      resolve({ ...emptySelection(), learned: null }, h).sort(),
      all,
    );
    assert.deepEqual(
      resolve({ ...emptySelection(), learned: { from: null, to: null } }, h).sort(),
      all,
    );
  });
});

describe('dueFacts — the "Practice what\'s due" one-click pool', () => {
  // Stability chosen so a small multiple of it lands cleanly in each of
  // scoring.status()'s three bands (see scoring.test.ts's own use of the same
  // 10-day/100-day shape): elapsed = stability → recall ≈ 1/e ≈ 0.37 → probe;
  // elapsed = 0 → recall = 1 → quiet; elapsed ≫ stability → recall ≈ 0 → teach.
  const DAY = 86_400_000;
  const stable = { stability: 10, lastTested: 0 };
  const [probeFact, quietFact, teachFact, unmetFact] = KANA_IDS.slice(0, 4);

  const h: HistoryFile = history({
    facts: {
      [probeFact]: seen({ ...stable, lastTested: NOW - 10 * DAY }),
      [quietFact]: seen({ ...stable, lastTested: NOW }),
      [teachFact]: seen({ ...stable, lastTested: NOW - 200 * DAY }),
    } as Record<FactId, FactAggregate>,
    // Claimed but never tested — UNMET, which is p → 0 and so also `teach`,
    // not a fourth state (see scoring.ts's UNMET doc: never-met and lost are
    // the identical state, and the model cannot tell them apart).
    claims: { [unmetFact]: NOW },
  });

  test("keeps only the facts scoring.status() calls `probe`, drops quiet and teach", () => {
    assert.deepEqual(dueFacts(h, [], NOW), [probeFact]);
  });

  test("is exactly the everything-scope pool filtered to `probe` — not a second model", () => {
    // The pool a "Due" status chip WOULD filter, if the builder had one: the
    // same "everything I know" pool the Scope buttons already produce
    // (resolve(emptySelection(), …)), narrowed by the identical status() call
    // budget.ts and library/slice.ts already use to decide what to ask first.
    const everything = resolve(emptySelection(), h, [], 0, { now: NOW });
    const wouldBeDue = everything.filter((f) => {
      const state = effectiveState(h.facts[f], h.claims?.[f], h.seen?.[f]);
      return status(state, NOW) === "probe";
    });
    assert.deepEqual(dueFacts(h, [], NOW).sort(), wouldBeDue.sort());
  });

  test("nothing due — day one, or an all-quiet history — is an empty pool, not everything", () => {
    assert.deepEqual(dueFacts(history(), [], NOW), []);
    const allQuiet = history({
      facts: { [quietFact]: seen({ ...stable, lastTested: NOW }) } as Record<
        FactId,
        FactAggregate
      >,
    });
    assert.deepEqual(dueFacts(allQuiet, [], NOW), []);
  });
});
