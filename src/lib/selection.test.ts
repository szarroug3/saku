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
//   2. The result is a RANDOM sample in RANDOM order, because this is a review
//      screen: the old "hardest first" sort drilled the same worst N in the same
//      order every time. The weakness ranking still runs — but on the learning
//      loop, which never comes through resolve().
//
// Both are asserted against the real kana data rather than a fixture: the thing
// under test is precisely that resolve() cuts the REAL registry the right way.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_FACTS } from "../data/characters.ts";
import { ALL_FACTS } from "./facts.ts";
import { countOf, emptySelection, resolve, subjectWord } from "./selection.ts";
import type { FactAggregate, FactId, HistoryFile } from "../types/index.ts";

const NOW = Date.UTC(2026, 0, 15);
const KANA_IDS: FactId[] = KANA_FACTS.map((f) => f.id);

/** A fact the user has answered — `seen ≥ 1`, so it is in the knowledge base. */
function seen(over: Partial<FactAggregate> = {}): FactAggregate {
  return {
    seen: 4,
    missed: 0,
    slow: 0,
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

describe("the drill is a RANDOM sample in RANDOM order", () => {
  const pool = KANA_IDS.slice(0, 30);
  const h = knowing(pool);

  test("a limit yields min(pool, limit) facts, all from the pool", () => {
    const inPool = new Set(pool);
    for (let i = 0; i < 10; i++) {
      const out = resolve({ ...emptySelection(), limit: 10 }, h);
      assert.equal(out.length, 10);
      assert.equal(new Set(out).size, 10, "no duplicates");
      for (const f of out) assert.ok(inPool.has(f), "sampled from the pool");
    }
  });

  test("the COUNT is stable across draws — only which facts changes", () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(countOf({ ...emptySelection(), limit: 10 }, h), 10);
    }
  });

  test("the same query drilled twice gives a different sample/order", () => {
    const seenOrderings = new Set<string>();
    for (let i = 0; i < 30; i++) {
      seenOrderings.add(resolve({ ...emptySelection(), limit: 10 }, h).join(","));
    }
    // With 30 facts sampled 10 at a time, identical orderings across 30 draws is
    // astronomically unlikely — a deterministic (old "hardest first") resolve
    // would produce exactly one. More than one proves the sample is random.
    assert.ok(seenOrderings.size > 1, "repeated drills must not be identical");
  });

  test("no limit returns the whole known pool, shuffled", () => {
    const out = resolve(emptySelection(), h);
    assert.equal(out.length, pool.length);
    assert.deepEqual([...out].sort(), [...pool].sort());
  });
});

describe("grammar is title-cased on the subject chip", () => {
  test('subjectWord("grammar") reads "Grammar", not the raw id', () => {
    assert.equal(subjectWord("grammar"), "Grammar");
  });
});
