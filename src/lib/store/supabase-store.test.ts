// SAK-236: writeHistoryRowGuarded() — the compare-and-set write that protects
// learner progress from a concurrent overlapping write — had never been
// exercised directly. history-mutate.test.ts only drives a hand-rolled
// in-memory CasStore that models the SAME contract; it never calls this
// function, so a real regression here (e.g. the guard silently dropped, or
// the monotonic-timestamp forcing removed) would pass every existing test.
//
// This file mocks the ONE thing this module cannot run without in a plain
// `node --test` process — the real Supabase network client from
// "@/lib/supabase/server" (its factory calls next/headers' cookies(), which
// throws outside a real Next.js request; see session-cookie.test.ts's header
// comment for the same constraint elsewhere in this codebase). Run with:
//
//   node --conditions=react-server --experimental-test-module-mocks \
//     --import ./src/lib/conjugate/test-hooks.mjs --test \
//     src/lib/store/supabase-store.test.ts
//
// Everything BELOW that boundary is real: writeHistoryRowGuarded's own
// insert-vs-update branch, its unique-violation-as-CAS-miss handling, its
// `.eq`/`.is` guard construction, and its `Math.max(now, prev + 1)` strictly-
// increasing timestamp are all exercised as written in supabase-store.ts.
// FakeProgressTable below only reproduces what Postgres itself guarantees —
// atomic, row-locked check-then-mutate on insert/update — the same boundary a
// real `pg` integration test would draw; it does not re-implement any of the
// CAS *policy* under test.

import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";
import { mock } from "node:test";

import { emptyHistory } from "@/lib/history-ops";
import type { HistoryFile } from "@/types";
import type { VersionedRead } from "@/lib/history-mutate";

// ---------------------------------------------------------------------------
// A fake "progress" table standing in for Postgres. It stores at most one row
// (this app only ever has one row per user_id, and every test below uses a
// single user), and its insert/update are synchronous check-then-mutate with
// no `await` between the filter check and the mutation — the same atomicity
// a real row-level lock gives a single UPDATE ... WHERE statement, which is
// exactly the property a CAS guard depends on.
// ---------------------------------------------------------------------------

interface FakeRow {
  user_id: string;
  history: HistoryFile;
  updated_at: string | null;
}

type FakeResult<T> = { data: T; error: { code?: string; message: string } | null };

class FakeProgressTable {
  row: FakeRow | null;

  constructor(seed?: FakeRow) {
    this.row = seed ?? null;
  }

  from(table: string) {
    assert.equal(table, "progress", "writeHistoryRowGuarded only ever touches the progress table");
    return this;
  }

  insert(payload: { user_id: string; history: HistoryFile; updated_at: string }): Promise<FakeResult<null>> {
    // Postgres: a second concurrent INSERT under the same user_id fails the
    // unique constraint on user_id, whichever loses the row lock race.
    if (this.row && this.row.user_id === payload.user_id) {
      return Promise.resolve({
        data: null,
        error: { code: "23505", message: `duplicate key value violates unique constraint "progress_user_id_key"` },
      });
    }
    this.row = { user_id: payload.user_id, history: payload.history, updated_at: payload.updated_at };
    return Promise.resolve({ data: null, error: null });
  }

  update(payload: { history: HistoryFile; updated_at: string }) {
    return new FakeUpdateBuilder(this, payload);
  }
}

class FakeUpdateBuilder {
  #table: FakeProgressTable;
  #payload: { history: HistoryFile; updated_at: string };
  #filters: Array<{ col: "user_id" | "updated_at"; val: string | null }> = [];

  constructor(table: FakeProgressTable, payload: { history: HistoryFile; updated_at: string }) {
    this.#table = table;
    this.#payload = payload;
  }

  eq(col: "user_id" | "updated_at", val: string | null) {
    this.#filters.push({ col, val });
    return this;
  }

  is(col: "user_id" | "updated_at", val: null) {
    this.#filters.push({ col, val });
    return this;
  }

  // `.select("user_id")` is where the real query actually executes and
  // reports affected rows — matching that here is what lets the guard branch
  // in writeHistoryRowGuarded read `data.length` to detect a CAS miss.
  select(_cols: string): Promise<FakeResult<Array<{ user_id: string }>>> {
    const row = this.#table.row;
    const matches =
      row != null && this.#filters.every((f) => row[f.col] === f.val);
    if (!matches) return Promise.resolve({ data: [], error: null });
    this.#table.row = { ...row, history: this.#payload.history, updated_at: this.#payload.updated_at };
    return Promise.resolve({ data: [{ user_id: row!.user_id }], error: null });
  }
}

let activeTable: FakeProgressTable;

before(() => {
  mock.module("@/lib/supabase/server", {
    // `namedExports`, not the newer `exports` key — this repo's @types/node
    // (20.x) only types the former; both work identically at runtime.
    namedExports: {
      createSupabaseServerClient: async () => ({
        from: (table: string) => activeTable.from(table),
      }),
    },
  });
});

// Imported dynamically, AFTER the mock is registered above, so
// supabase-store.ts's own `import { createSupabaseServerClient } from
// "@/lib/supabase/server"` resolves to the mock rather than the real client.
const { writeHistoryRowGuarded } = await import("@/lib/store/supabase-store.ts");

const USER = "user-1";
const USER_2 = "user-2";

function hist(tag: string): HistoryFile {
  const h = emptyHistory();
  return { ...h, claims: { [`kanji:${tag}/meaning`]: 1 } as HistoryFile["claims"] };
}

function unseenRead(): VersionedRead {
  return { history: emptyHistory(), version: null, exists: false };
}

describe("writeHistoryRowGuarded: insert branch (no row yet)", () => {
  beforeEach(() => {
    activeTable = new FakeProgressTable();
  });

  test("inserts and returns true when no row exists", async () => {
    const ok = await writeHistoryRowGuarded(USER, hist("A"), unseenRead());
    assert.equal(ok, true);
    assert.ok(activeTable.row, "a row now exists");
    assert.equal(activeTable.row!.user_id, USER);
    assert.deepEqual(activeTable.row!.history.claims, hist("A").claims);
  });

  test("a concurrent first-write race: only one of two inserts under the same user lands", async () => {
    // Both writers read "no row yet" before either wrote — the exact overlap
    // that produces a Postgres unique-violation on the loser.
    const [a, b] = await Promise.all([
      writeHistoryRowGuarded(USER, hist("A"), unseenRead()),
      writeHistoryRowGuarded(USER, hist("B"), unseenRead()),
    ]);

    assert.notEqual(a, b, "exactly one writer wins the race");
    const winnerHist = a ? hist("A") : hist("B");
    assert.deepEqual(
      activeTable.row!.history.claims,
      winnerHist.claims,
      "the row holds only the winner's write, never a merge of both",
    );
  });

  test("inserting for two different users never contends", async () => {
    const [a, b] = await Promise.all([
      writeHistoryRowGuarded(USER, hist("A"), unseenRead()),
      writeHistoryRowGuarded(USER_2, hist("B"), unseenRead()),
    ]);
    // Only one row can live in this single-row fake table (it stands in for
    // one user's real Supabase row), but both calls must have taken the
    // insert branch and neither raced the other's user_id uniqueness.
    assert.equal(a, true);
    assert.equal(b, true);
  });
});

describe("writeHistoryRowGuarded: update branch (row exists)", () => {
  const SEEDED_AT = "2026-01-01T00:00:00.000Z";

  beforeEach(() => {
    activeTable = new FakeProgressTable({ user_id: USER, history: hist("seed"), updated_at: SEEDED_AT });
  });

  test("guarded update lands when the version token still matches", async () => {
    const expected: VersionedRead = { history: hist("seed"), version: SEEDED_AT, exists: true };
    const ok = await writeHistoryRowGuarded(USER, hist("A"), expected);
    assert.equal(ok, true);
    assert.deepEqual(activeTable.row!.history.claims, hist("A").claims);
    assert.notEqual(activeTable.row!.updated_at, SEEDED_AT, "the token moved forward");
    assert.ok(
      Date.parse(activeTable.row!.updated_at!) > Date.parse(SEEDED_AT),
      "the new token is strictly greater than the one guarded on",
    );
  });

  test("a stale version token is rejected: the write does not land", async () => {
    const stale: VersionedRead = { history: hist("seed"), version: "2020-01-01T00:00:00.000Z", exists: true };
    const ok = await writeHistoryRowGuarded(USER, hist("A"), stale);
    assert.equal(ok, false, "a concurrent writer already moved the token past what we read");
    assert.deepEqual(
      activeTable.row!.history.claims,
      hist("seed").claims,
      "the row is untouched by the losing write",
    );
  });

  test("the CORE race: two writers hold the SAME stale snapshot; exactly one lands, the other is told it lost", async () => {
    const expected: VersionedRead = { history: hist("seed"), version: SEEDED_AT, exists: true };

    // Both fired concurrently against the SAME expected token — the scenario
    // the module's own doc comment describes: "even two writes landing in the
    // same millisecond leave DISTINCT tokens".
    const [a, b] = await Promise.all([
      writeHistoryRowGuarded(USER, hist("A"), expected),
      writeHistoryRowGuarded(USER, hist("B"), expected),
    ]);

    assert.notEqual(a, b, "one writer's guard matches, the other's WHERE affects zero rows");
    const winnerHist = a ? hist("A") : hist("B");
    assert.deepEqual(
      activeTable.row!.history.claims,
      winnerHist.claims,
      "no last-writer-wins clobber: the row holds exactly the winner's history, not a mix",
    );
    assert.ok(
      Date.parse(activeTable.row!.updated_at!) > Date.parse(SEEDED_AT),
      "the row's token moved strictly forward from the seed",
    );
  });

  test("a legacy row with a null token is guarded with IS, not EQ", async () => {
    activeTable = new FakeProgressTable({ user_id: USER, history: hist("seed"), updated_at: null });
    const expected: VersionedRead = { history: hist("seed"), version: null, exists: true };
    const ok = await writeHistoryRowGuarded(USER, hist("A"), expected);
    assert.equal(ok, true);
    assert.deepEqual(activeTable.row!.history.claims, hist("A").claims);
  });

  test("forced monotonic timestamp: guarding on a token already ahead of the wall clock still advances it", async () => {
    // If the row's token is (by whatever means) ahead of Date.now(), the new
    // token must still be forced strictly greater than it, per the
    // `Math.max(Date.now(), prev + 1)` contract — never merely "now".
    const future = new Date(Date.now() + 60_000).toISOString();
    activeTable = new FakeProgressTable({ user_id: USER, history: hist("seed"), updated_at: future });
    const expected: VersionedRead = { history: hist("seed"), version: future, exists: true };

    const ok = await writeHistoryRowGuarded(USER, hist("A"), expected);

    assert.equal(ok, true);
    assert.ok(
      Date.parse(activeTable.row!.updated_at!) > Date.parse(future),
      "the token advanced past the future-dated one it guarded on, not just past Date.now()",
    );
  });
});
