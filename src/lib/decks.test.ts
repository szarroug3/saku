// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/decks.test.ts
//
// decks.ts turns history into the drillable lists a learner clicks. Pinned here:
//   - lastSession is the most RECENT run by ts, not the last one appended;
//   - lastMisses is the FORGIVING reading (wrong at least once OR never landed),
//     most misses first — the "Redrill the misses" set;
//   - confusionDecks falls back to the day-one LOOKALIKES with fromHistory=false
//     and count 0, so the UI never claims a mix-up the user didn't produce.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { confusionDecks, lastMisses, lastSession } from "@/lib/decks";
import { entryOf } from "@/lib/facts";
import type {
  FactId,
  FactSessionDetail,
  HistoryFile,
  QuizSessionRecord,
} from "@/types";

const fid = (s: string) => s as unknown as FactId;

function detail(p: Partial<FactSessionDetail>): FactSessionDetail {
  return {
    seen: 1,
    misses: 0,
    everCorrect: true,
    firstTryCorrect: true,
    firstTryCount: 1,
    correct: 1,
    slow: 0,
    confused: {},
    ...p,
  };
}

function session(
  ts: number,
  detailMap?: Record<string, FactSessionDetail>,
): QuizSessionRecord {
  return {
    ts,
    mode: "drill",
    redrill: false,
    total: 1,
    forgivingPct: 100,
    strictPct: 100,
    facts: {} as QuizSessionRecord["facts"],
    ...(detailMap ? { detail: detailMap as QuizSessionRecord["detail"] } : {}),
  };
}

function history(sessions: QuizSessionRecord[]): HistoryFile {
  return { sessions, facts: {} };
}

describe("lastSession", () => {
  test("null with no sessions", () => {
    assert.equal(lastSession(history([])), null);
  });

  test("the newest by ts, even when appended out of order", () => {
    const h = history([session(3000), session(9000), session(5000)]);
    assert.equal(lastSession(h)!.ts, 9000);
  });
});

describe("lastMisses", () => {
  test("empty when the latest session has no detail", () => {
    assert.deepEqual(lastMisses(history([session(1000)])), []);
  });

  test("reads the LATEST session's detail, not an earlier one", () => {
    const older = session(1000, { [fid("hira-a")]: detail({ misses: 5 }) });
    const newer = session(2000, { [fid("hira-i")]: detail({ misses: 1 }) });
    assert.deepEqual(lastMisses(history([older, newer])), [fid("hira-i")]);
  });

  test("a fact wrong at least once counts as a miss", () => {
    const d = { [fid("hira-a")]: detail({ misses: 2, everCorrect: true }) };
    assert.deepEqual(lastMisses(history([session(1000, d)])), [fid("hira-a")]);
  });

  test("a fact never gotten right counts as a miss even with 0 wrong attempts", () => {
    // Quiz ended before it was answered: misses 0 but everCorrect false.
    const d = { [fid("hira-a")]: detail({ misses: 0, everCorrect: false }) };
    assert.deepEqual(lastMisses(history([session(1000, d)])), [fid("hira-a")]);
  });

  test("a clean fact is not a miss, and misses are ordered most-first", () => {
    const d = {
      [fid("clean")]: detail({ misses: 0, everCorrect: true }),
      [fid("few")]: detail({ misses: 1 }),
      [fid("many")]: detail({ misses: 4 }),
    };
    assert.deepEqual(lastMisses(history([session(1000, d)])), [fid("many"), fid("few")]);
  });
});

describe("confusionDecks", () => {
  test("no measured confusions → the LOOKALIKES fallback, flagged fromHistory=false", () => {
    const c = confusionDecks(history([]));
    assert.equal(c.fromHistory, false);
    assert.ok(c.pairs.length > 0, "day one still offers something to drill");
    assert.ok(c.facts.length > 0, "and real facts behind it");
    // Nothing may claim a count the user never produced.
    assert.ok(c.pairs.every((p) => p.count === 0), "fallback pairs carry no count");
  });

  test("measured mix-ups win over the fallback and fold symmetrically", () => {
    // The shown fact lifts to its ENTRY; the confused key is a DIFFERENT real
    // entry. Derive both from the registry so the pair is genuinely measured.
    const shown = fid("hira-a");
    const otherEntry = entryOf(fid("hira-i"));
    assert.notEqual(entryOf(shown), otherEntry, "need two distinct entries");

    const c = confusionDecks(
      history([
        session(1000, { [shown]: detail({ confused: { [otherEntry]: 3 } }) }),
      ]),
    );

    assert.equal(c.fromHistory, true, "a measured confusion is not the fallback");
    assert.equal(c.pairs.length, 1, "one folded pair");
    assert.equal(c.pairs[0].count, 3);
    assert.deepEqual(
      [c.pairs[0].a, c.pairs[0].b].sort(),
      [entryOf(shown), otherEntry].sort(),
      "the pair is the two entries, orientation-independent",
    );
  });

  test("the two directions of one mix-up fold into a single symmetric pair", () => {
    const a = fid("hira-a");
    const b = fid("hira-i");
    const eA = entryOf(a);
    const eB = entryOf(b);
    const c = confusionDecks(
      history([
        // "said B when shown A" three times, "said A when shown B" twice.
        session(1000, {
          [a]: detail({ confused: { [eB]: 3 } }),
          [b]: detail({ confused: { [eA]: 2 } }),
        }),
      ]),
    );
    assert.equal(c.pairs.length, 1, "folded, not two directional pairs");
    assert.equal(c.pairs[0].count, 5, "3 + 2");
  });
});
