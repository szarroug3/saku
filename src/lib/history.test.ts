// SAK-237 — history.ts's server orchestration for saveSession / dropClaims /
// deleteSessions / resetAll, specifically the split this ticket introduced:
// `facts` now lives in its own per-row store (progress_facts), addressed and
// mutated independently of the rest of a learner's history, with a fallback to
// the original whole-document behaviour when that table has not been created
// yet (see store/supabase-store.ts's `migrated` flag).
//
// Mocks "@/lib/store/supabase-store" — the ONE seam history.ts and fact-store.ts
// both cross to reach Supabase — with an in-memory model of the SAME two
// surfaces a real deployment has: the `progress` row (sessions/claims/seen/
// learnedAt/clearedMixups + a legacy `facts` blob) and the `progress_facts`
// table (one row per fact). supabase-store.test.ts already pins the real CAS
// mechanics against a fake Postgres client; this file pins history.ts's
// ORCHESTRATION — which store calls happen, with what arguments, and in what
// order — against a fake of that already-tested seam.
//
// Run with:
//   node --conditions=react-server --experimental-test-module-mocks \
//     --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/history.test.ts

import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";
import { mock } from "node:test";

import { emptyAggregate, foldSession } from "@/lib/aggregate";
import type { FactAggregate, FactId, HistoryFile, QuizSessionRecord } from "@/types";

const fid = (s: string) => s as unknown as FactId;

// ---------------------------------------------------------------------------
// The fake store: a `progress` row (doc) and a `progress_facts` table (facts),
// per user, with the same insert-vs-update-guarded-on-token CAS shape the real
// primitives use (see supabase-store.ts) — simplified (single-user tests never
// race), but enough to exercise history.ts's actual read → decide → write
// sequencing, including its no-op and pre-migration-fallback branches.
// ---------------------------------------------------------------------------

interface Doc {
  sessions: QuizSessionRecord[];
  claims: Record<string, number>;
  seen: Record<string, number>;
  learnedAt: Record<string, number>;
  clearedMixups: Record<string, number>;
  facts: Record<string, FactAggregate>;
}

function emptyDoc(): Doc {
  return { sessions: [], claims: {}, seen: {}, learnedAt: {}, clearedMixups: {}, facts: {} };
}

let progress: Map<string, { doc: Doc; version: string | null }>;
let facts: Map<string, Map<string, { aggregate: FactAggregate; version: string }>>;
let clock: number;

function reset() {
  progress = new Map();
  facts = new Map();
  clock = 0;
}

function nextToken(prevVersion: string | null): string {
  const prev = prevVersion ? Date.parse(prevVersion) : 0;
  clock = Math.max(clock + 1, prev + 1);
  return new Date(clock).toISOString();
}

const fakeExports = {
  async readHistoryRow(userId: string) {
    const doc = progress.get(userId)?.doc ?? emptyDoc();
    // SAK-405: the facts come from the table and only the table, exactly as
    // shapeHistory does now. The jsonb `facts` key is not read.
    const tableFacts = Object.fromEntries(
      [...(facts.get(userId) ?? [])].map(([k, v]) => [k, v.aggregate]),
    );
    return { ...doc, facts: tableFacts } as unknown as HistoryFile;
  },
  async readProgressSeedRow(): Promise<never> {
    throw new Error("not exercised by these tests");
  },
  async readHistoryRowVersioned(userId: string) {
    const row = progress.get(userId);
    if (!row) return { history: emptyDoc() as unknown as HistoryFile, version: null, exists: false };
    return { history: row.doc as unknown as HistoryFile, version: row.version, exists: true };
  },
  async writeHistoryRow(userId: string, hist: HistoryFile) {
    progress.set(userId, { doc: hist as unknown as Doc, version: nextToken(null) });
  },
  async writeHistoryRowGuarded(userId: string, hist: HistoryFile, expected: { version: string | null; exists: boolean }) {
    const row = progress.get(userId);
    if (!expected.exists) {
      if (row) return false;
      progress.set(userId, { doc: hist as unknown as Doc, version: nextToken(null) });
      return true;
    }
    if (!row || row.version !== expected.version) return false;
    progress.set(userId, { doc: hist as unknown as Doc, version: nextToken(row.version) });
    return true;
  },
  async readFactRowsVersioned(userId: string, factIds: FactId[]) {
    const rows = new Map<FactId, { aggregate: FactAggregate | null; version: string | null; exists: boolean }>();
    for (const id of factIds) rows.set(id, { aggregate: null, version: null, exists: false });
    const userFacts = facts.get(userId);
    if (userFacts) {
      for (const id of factIds) {
        const r = userFacts.get(id);
        if (r) rows.set(id, { aggregate: r.aggregate, version: r.version, exists: true });
      }
    }
    return rows;
  },
  async readFactRowVersioned(userId: string, factId: FactId) {
    const rows = await fakeExports.readFactRowsVersioned(userId, [factId]);
    return rows.get(factId)!;
  },
  async writeFactRowGuarded(
    userId: string,
    factId: FactId,
    aggregate: FactAggregate,
    expected: { version: string | null; exists: boolean },
  ) {
    let userFacts = facts.get(userId);
    if (!userFacts) {
      userFacts = new Map();
      facts.set(userId, userFacts);
    }
    const cur = userFacts.get(factId);
    if (!expected.exists) {
      if (cur) return false;
      userFacts.set(factId, { aggregate, version: nextToken(null) });
      return true;
    }
    if (!cur || cur.version !== expected.version) return false;
    userFacts.set(factId, { aggregate, version: nextToken(cur.version) });
    return true;
  },
  async deleteFactRows(userId: string, factIds: FactId[]) {
    const userFacts = facts.get(userId);
    if (userFacts) for (const id of factIds) userFacts.delete(id);
  },
  async deleteAllFactRows(userId: string) {
    facts.delete(userId);
  },
  async replaceAllFactRows(userId: string, newFacts: Record<string, FactAggregate>) {
    const m = new Map<string, { aggregate: FactAggregate; version: string }>();
    for (const [id, agg] of Object.entries(newFacts)) m.set(id, { aggregate: agg, version: nextToken(null) });
    facts.set(userId, m);
  },
};

before(() => {
  mock.module("@/lib/store/supabase-store", { namedExports: fakeExports });
});

const {
  dropClaims,
  deleteSessions,
  resetAll,
  saveSession,
} = await import("@/lib/history.ts");

const USER = "user-1";

function session(ts: number, factDeltas: Record<string, { seen: number; missed: number; firstTry: number; correct: number }>, id?: string): QuizSessionRecord {
  return {
    ...(id ? { id } : {}),
    ts,
    mode: "drill",
    redrill: false,
    total: Object.keys(factDeltas).length,
    forgivingPct: 100,
    strictPct: 100,
    facts: factDeltas as QuizSessionRecord["facts"],
  };
}

describe("saveSession — SAK-237 per-fact split", () => {
  beforeEach(reset);

  test("touches ONLY the progress_facts rows for facts the session named, not the whole document", async () => {
    const result = await saveSession(
      USER,
      session(1000, { [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }),
    );
    assert.equal(result.sessions.length, 1);
    // The small doc's own facts key was never written to — the fold landed in
    // the table instead.
    assert.deepEqual(progress.get(USER)!.doc.facts, {});
    const stored = facts.get(USER)!.get("a")!.aggregate;
    const expected = emptyAggregate();
    foldSession(expected, { seen: 1, missed: 0, firstTry: 1, correct: 1 }, 1000);
    assert.deepEqual(stored, expected);
  });

  test("a second session folds ONTO the first fact's stored aggregate, not from scratch", async () => {
    await saveSession(USER, session(1000, { [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }));
    await saveSession(USER, session(2000, { [fid("a")]: { seen: 1, missed: 1, firstTry: 0, correct: 1 } }));

    const expected = emptyAggregate();
    foldSession(expected, { seen: 1, missed: 0, firstTry: 1, correct: 1 }, 1000);
    foldSession(expected, { seen: 1, missed: 1, firstTry: 0, correct: 1 }, 2000);
    assert.deepEqual(facts.get(USER)!.get("a")!.aggregate, expected);
  });

  test("id-dedup: a retried session neither re-appends nor re-folds", async () => {
    await saveSession(USER, session(1000, { [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }, "req-1"));
    const afterFirst = structuredClone(facts.get(USER)!.get("a")!.aggregate);

    const result = await saveSession(
      USER,
      session(1000, { [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }, "req-1"),
    );

    assert.equal(result.sessions.length, 1, "the retry did not double-append");
    assert.deepEqual(facts.get(USER)!.get("a")!.aggregate, afterFirst, "the retry did not double-fold");
  });

  test("a session touching several facts folds each independently", async () => {
    await saveSession(
      USER,
      session(1000, {
        [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 },
        [fid("b")]: { seen: 1, missed: 1, firstTry: 0, correct: 0 },
      }),
    );
    assert.equal(facts.get(USER)!.size, 2);
    assert.ok(facts.get(USER)!.get("a"));
    assert.ok(facts.get(USER)!.get("b"));
  });

  test("the fold lands in the table and nothing goes into the document's facts key", async () => {
    await saveSession(
      USER,
      session(1000, { [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }),
    );
    const expected = emptyAggregate();
    foldSession(expected, { seen: 1, missed: 0, firstTry: 1, correct: 1 }, 1000);
    assert.deepEqual(facts.get(USER)!.get("a")!.aggregate, expected);
    assert.deepEqual(progress.get(USER)!.doc.facts, {}, "the jsonb blob is not a second copy (SAK-405)");
  });

  test("a session with no facts (empty round) never touches the facts table at all", async () => {
    await saveSession(USER, session(1000, {}));
    assert.equal(facts.has(USER), false);
  });
});

describe("dropClaims — SAK-237: the fact-aggregate delete no longer reads/rewrites the whole facts blob", () => {
  beforeEach(async () => {
    reset();
    await saveSession(USER, session(1000, { [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }));
    progress.get(USER)!.doc.claims = { a: 1000, b: 2000 };
  });

  test("migrated: deletes the claim and the fact row, leaves the other claim alone", async () => {
    const result = await dropClaims(USER, [fid("a")]);
    assert.deepEqual(result.claims, { b: 2000 });
    assert.equal(facts.get(USER)!.has("a"), false);
  });

});

describe("deleteSessions — SAK-237: the rebuild replaces the table, sized by surviving sessions", () => {
  beforeEach(reset);

  test("migrated: rebuilds progress_facts from the surviving sessions only", async () => {
    await saveSession(USER, session(1000, { [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }, "s1"));
    await saveSession(USER, session(2000, { [fid("b")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }, "s2"));

    await deleteSessions(USER, ["s1"], false);

    assert.equal(facts.get(USER)!.has("a"), false, "the deleted session's fact is gone");
    assert.ok(facts.get(USER)!.has("b"), "the surviving session's fact remains");
  });

  test("an empty selection writes nothing and does not touch the facts table", async () => {
    await saveSession(USER, session(1000, { [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }, "s1"));
    const before = structuredClone(facts.get(USER)!.get("a")!);

    await deleteSessions(USER, [], false);

    assert.deepEqual(facts.get(USER)!.get("a"), before);
  });
});

describe("resetAll — SAK-237: wipes the facts table alongside the document", () => {
  beforeEach(reset);

  test("clears sessions/claims AND every fact row", async () => {
    await saveSession(USER, session(1000, { [fid("a")]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }));
    await resetAll(USER);
    assert.equal(progress.get(USER)!.doc.sessions.length, 0);
    assert.equal(facts.has(USER), false);
  });
});
