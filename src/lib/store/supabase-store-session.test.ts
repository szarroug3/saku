// SAK-404: `readSessionRow` and `writeSessionRow` in supabase-store.ts, the
// `session` jsonb column, which now holds the quiz run a signed-in learner
// left part way through.
//
// A signed-in resume cannot be driven end to end in this repo's e2e build
// (auth is disabled there), so this file is that half of the gate: the read
// and the write exercised as written, against a fake `progress` table that
// reproduces only what Postgres itself guarantees: one row per user, an
// upsert that touches the named columns and no others, `maybeSingle`
// answering null for a user with no row.
//
// The column-is-untouched property is the one worth the fake: nothing here
// re-implements any policy, but a `history` or `settings` key creeping into
// the upsert payload would silently blank a learner's progress every time
// they answered a card, and no other test in this repo would notice.
//
// Its own file rather than an addition to supabase-store.test.ts, for the
// reason that file's neighbour already gives: two fake tables of very
// different shapes should not share one mock registration.
//
// Run with:
//   node --conditions=react-server --experimental-test-module-mocks \
//     --import ./src/lib/conjugate/test-hooks.mjs --test \
//     src/lib/store/supabase-store-session.test.ts

import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";
import { mock } from "node:test";

type FakeResult<T> = { data: T; error: { code?: string; message: string } | null };

interface FakeRow {
  user_id: string;
  history: unknown;
  settings: unknown;
  session: unknown;
  updated_at: string | null;
}

/** The `progress` table, one row per user, with the two shapes these
 * primitives build: `select(...).eq(...).maybeSingle()` and `upsert`. */
class FakeProgressTable {
  rows = new Map<string, FakeRow>();
  /** Every column name any upsert has named, so a test can assert that
   * writing a run never so much as mentions the progress columns. */
  upserted: string[][] = [];
  fail: { code?: string; message: string } | null = null;

  from(table: string) {
    assert.equal(table, "progress", "the session primitives only touch the progress table");
    return this;
  }

  select(cols: string) {
    return new Query(this, cols);
  }

  upsert(payload: Record<string, unknown>, options: { onConflict: string }): Promise<FakeResult<null>> {
    assert.equal(options.onConflict, "user_id", "the row is keyed by user");
    this.upserted.push(Object.keys(payload));
    if (this.fail) return Promise.resolve({ data: null, error: this.fail });
    const userId = payload.user_id as string;
    const before = this.rows.get(userId) ?? { user_id: userId, history: null, settings: null, session: null, updated_at: null };
    // An upsert leaves columns it does not name exactly as they were, which
    // is the property `writeSessionRow` leans on.
    this.rows.set(userId, { ...before, ...(payload as Partial<FakeRow>) });
    return Promise.resolve({ data: null, error: null });
  }
}

class Query {
  #table: FakeProgressTable;
  #cols: string;
  #userId: string | null = null;

  constructor(table: FakeProgressTable, cols: string) {
    this.#table = table;
    this.#cols = cols;
  }

  eq(col: string, val: string) {
    assert.equal(col, "user_id");
    this.#userId = val;
    return this;
  }

  maybeSingle(): Promise<FakeResult<Record<string, unknown> | null>> {
    if (this.#table.fail) return Promise.resolve({ data: null, error: this.#table.fail });
    const row = this.#userId ? this.#table.rows.get(this.#userId) : undefined;
    if (!row) return Promise.resolve({ data: null, error: null });
    // PostgREST returns only the columns asked for.
    const picked: Record<string, unknown> = {};
    for (const col of this.#cols.split(",").map((c) => c.trim())) picked[col] = (row as unknown as Record<string, unknown>)[col];
    return Promise.resolve({ data: picked, error: null });
  }
}

let table: FakeProgressTable;

before(() => {
  mock.module("@/lib/supabase/server", {
    namedExports: {
      createSupabaseServerClient: async () => ({
        from: (name: string) => table.from(name),
      }),
    },
  });
});

const { readSessionRow, writeSessionRow } = await import("@/lib/store/supabase-store.ts");

const USER = "user-1";
const RUN = { deck: ["a", "b", "c"], at: 1, answers: [{ cardId: "a", grade: "clean", tries: 1, narrowed: false, hinted: false }], from: {}, leftAt: 1000 };

describe("the run a learner left, on their account", () => {
  beforeEach(() => {
    table = new FakeProgressTable();
  });

  test("is null for a learner with no row at all", async () => {
    assert.equal(await readSessionRow(USER), null);
  });

  test("is null for a row whose column has never been written", async () => {
    table.rows.set(USER, { user_id: USER, history: { claims: {} }, settings: {}, session: null, updated_at: null });
    assert.equal(await readSessionRow(USER), null);
  });

  test("comes back as it was written", async () => {
    await writeSessionRow(USER, RUN);
    assert.deepEqual(await readSessionRow(USER), RUN);
  });

  test("is cleared by writing null, and reads as no run", async () => {
    await writeSessionRow(USER, RUN);
    await writeSessionRow(USER, null);
    assert.equal(await readSessionRow(USER), null);
    assert.equal(table.rows.get(USER)!.session, null);
  });

  test("is one learner's own: another user's row is not read or written", async () => {
    await writeSessionRow(USER, RUN);
    assert.equal(await readSessionRow("user-2"), null);
    await writeSessionRow("user-2", { ...RUN, at: 2 });
    assert.deepEqual(await readSessionRow(USER), RUN);
  });

  test("never disturbs the history or the settings beside it", async () => {
    const history = { claims: { "kanji:x/meaning": 1 } };
    const settings = { cfg: { retries: 2 } };
    table.rows.set(USER, { user_id: USER, history, settings, session: null, updated_at: null });
    await writeSessionRow(USER, RUN);
    assert.deepEqual(table.rows.get(USER)!.history, history);
    assert.deepEqual(table.rows.get(USER)!.settings, settings);
    for (const cols of table.upserted) {
      assert.ok(!cols.includes("history"), "an upsert of a run must not name the history column");
      assert.ok(!cols.includes("settings"), "an upsert of a run must not name the settings column");
    }
  });

  test("the last write is the one that stands: a run is replaced, never folded", async () => {
    await writeSessionRow(USER, RUN);
    await writeSessionRow(USER, { ...RUN, at: 2, answers: [] });
    assert.deepEqual(await readSessionRow(USER), { ...RUN, at: 2, answers: [] });
  });

  test("a failing read or write says which column it was, and throws", async () => {
    table.fail = { message: "boom" };
    await assert.rejects(() => readSessionRow(USER), /reading progress\.session failed: boom/);
    await assert.rejects(() => writeSessionRow(USER, RUN), /writing progress\.session failed: boom/);
  });
});
