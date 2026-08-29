// SAK-237 — the `progress_facts` primitives in supabase-store.ts: per-fact
// reads/writes/deletes, and — just as important — every one of them degrading
// to a `migrated: false` result (or a silent no-op, for the void-returning
// deletes) instead of throwing when the table does not exist yet (Postgres
// 42P01, "relation does not exist"). That fallback is what makes merging this
// code safe regardless of whether scripts/sql/add-progress-facts-table.sql has
// been applied yet — see history.ts's callers, which branch on exactly this.
//
// A separate file from supabase-store.test.ts (which does the same job for
// `writeHistoryRowGuarded` against the `progress` table) rather than an
// addition to it, so the two fake tables — and their very different row
// shapes — never have to share one mock registration.
//
// Run with:
//   node --conditions=react-server --experimental-test-module-mocks \
//     --import ./src/lib/conjugate/test-hooks.mjs --test \
//     src/lib/store/supabase-store-facts.test.ts

import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";
import { mock } from "node:test";

// ---------------------------------------------------------------------------
// A fake `progress_facts` table plus a minimal chainable query builder — just
// enough of PostgREST's surface (`.eq`/`.in`/`.limit`/`.select` as a filter
// list, `.insert`/`.update`/`.delete` as the verb) for the handful of shapes
// supabase-store.ts's facts primitives actually build. `exists` flips to
// simulate the table being absent, producing the SAME 42P01 shape Postgres
// does.
// ---------------------------------------------------------------------------

interface FactRow {
  aggregate: unknown;
  updated_at: string;
}

type FakeResult<T> = { data: T; error: { code?: string; message: string } | null };

const UNDEFINED_TABLE = { code: "42P01", message: `relation "progress_facts" does not exist` };
const UNIQUE_VIOLATION = { code: "23505", message: `duplicate key value violates unique constraint` };

class FakeFactsTable {
  rows = new Map<string, Map<string, FactRow>>();
  exists = true;

  from(table: string) {
    assert.equal(table, "progress_facts");
    return this;
  }

  select(_cols: string) {
    return new Query(this, "select");
  }
  insert(payload: unknown) {
    return new Query(this, "insert", payload);
  }
  update(payload: { aggregate: unknown; updated_at: string }) {
    return new Query(this, "update", payload);
  }
  delete() {
    return new Query(this, "delete");
  }

  userRows(userId: string): Map<string, FactRow> {
    let m = this.rows.get(userId);
    if (!m) {
      m = new Map();
      this.rows.set(userId, m);
    }
    return m;
  }
}

class Query implements PromiseLike<FakeResult<unknown>> {
  #table: FakeFactsTable;
  #kind: "select" | "insert" | "update" | "delete";
  #payload: unknown;
  #userId?: string;
  #factId?: string;
  #factIdIn?: string[];
  #updatedAtFilter?: { op: "eq" | "is"; val: string | null };
  #limit?: number;

  constructor(table: FakeFactsTable, kind: "select" | "insert" | "update" | "delete", payload?: unknown) {
    this.#table = table;
    this.#kind = kind;
    this.#payload = payload;
  }

  eq(col: "user_id" | "fact_id" | "updated_at", val: string) {
    if (col === "user_id") this.#userId = val;
    else if (col === "fact_id") this.#factId = val;
    else this.#updatedAtFilter = { op: "eq", val };
    return this;
  }
  is(col: "updated_at", val: null) {
    this.#updatedAtFilter = { op: "is", val };
    return this;
  }
  in(col: "fact_id", vals: string[]) {
    this.#factIdIn = vals;
    return this;
  }
  limit(n: number) {
    this.#limit = n;
    return this;
  }
  select(_cols: string) {
    // Used as the "execute and report affected rows" trailer on `.update`,
    // exactly as writeHistoryRowGuarded's own `.select("user_id")` does.
    return this;
  }

  #execute(): FakeResult<unknown> {
    if (!this.#table.exists) return { data: null, error: UNDEFINED_TABLE };

    if (this.#kind === "select") {
      const userId = this.#userId!;
      let entries = [...this.#table.userRows(userId).entries()];
      if (this.#factIdIn) entries = entries.filter(([id]) => this.#factIdIn!.includes(id));
      if (this.#limit != null) entries = entries.slice(0, this.#limit);
      const data = entries.map(([fact_id, row]) => ({
        fact_id,
        user_id: userId,
        aggregate: row.aggregate,
        updated_at: row.updated_at,
      }));
      return { data, error: null };
    }

    if (this.#kind === "insert") {
      const rows = (Array.isArray(this.#payload) ? this.#payload : [this.#payload]) as Array<{
        user_id: string;
        fact_id: string;
        aggregate: unknown;
        updated_at: string;
      }>;
      for (const r of rows) {
        const m = this.#table.userRows(r.user_id);
        if (m.has(r.fact_id)) return { data: null, error: UNIQUE_VIOLATION };
      }
      for (const r of rows) {
        this.#table.userRows(r.user_id).set(r.fact_id, { aggregate: r.aggregate, updated_at: r.updated_at });
      }
      return { data: null, error: null };
    }

    if (this.#kind === "update") {
      const m = this.#table.userRows(this.#userId!);
      const cur = m.get(this.#factId!);
      if (!cur) return { data: [], error: null };
      if (this.#updatedAtFilter) {
        const matches =
          this.#updatedAtFilter.op === "is"
            ? cur.updated_at == null
            : cur.updated_at === this.#updatedAtFilter.val;
        if (!matches) return { data: [], error: null };
      }
      const payload = this.#payload as { aggregate: unknown; updated_at: string };
      m.set(this.#factId!, { aggregate: payload.aggregate, updated_at: payload.updated_at });
      return { data: [{ user_id: this.#userId }], error: null };
    }

    if (this.#kind === "delete") {
      const m = this.#table.rows.get(this.#userId!);
      if (m) {
        if (this.#factIdIn) for (const id of this.#factIdIn) m.delete(id);
        else m.clear();
      }
      return { data: null, error: null };
    }

    throw new Error(`unhandled kind ${this.#kind}`);
  }

  then<TResult1 = FakeResult<unknown>, TResult2 = never>(
    onfulfilled?: ((value: FakeResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.#execute()).then(onfulfilled, onrejected);
  }
}

let activeTable: FakeFactsTable;

before(() => {
  mock.module("@/lib/supabase/server", {
    namedExports: {
      createSupabaseServerClient: async () => ({
        from: (table: string) => activeTable.from(table),
      }),
    },
  });
});

const {
  deleteAllFactRows,
  deleteFactRows,
  factsTableMigrated,
  readFactRowVersioned,
  readFactRowsVersioned,
  readFactsTable,
  replaceAllFactRows,
  writeFactRowGuarded,
} = await import("@/lib/store/supabase-store.ts");

const USER = "user-1";
const fid = (s: string) => s as unknown as import("@/types").FactId;
const agg = (n: number) => ({ seen: n }) as unknown as import("@/types").FactAggregate;

describe("progress_facts: reads", () => {
  beforeEach(() => {
    activeTable = new FakeFactsTable();
  });

  test("readFactsTable assembles every row for the user into a map", async () => {
    activeTable.userRows(USER).set("a", { aggregate: agg(1), updated_at: "t1" });
    activeTable.userRows(USER).set("b", { aggregate: agg(2), updated_at: "t2" });
    const { facts, migrated } = await readFactsTable(USER);
    assert.equal(migrated, true);
    assert.deepEqual(facts, { a: agg(1), b: agg(2) });
  });

  test("readFactsTable: table absent → migrated:false, empty map, no throw", async () => {
    activeTable.exists = false;
    const { facts, migrated } = await readFactsTable(USER);
    assert.equal(migrated, false);
    assert.deepEqual(facts, {});
  });

  test("readFactRowsVersioned only returns the requested ids, others default to not-exists", async () => {
    activeTable.userRows(USER).set("a", { aggregate: agg(1), updated_at: "t1" });
    activeTable.userRows(USER).set("untouched", { aggregate: agg(99), updated_at: "t9" });
    const { rows, migrated } = await readFactRowsVersioned(USER, [fid("a"), fid("missing")]);
    assert.equal(migrated, true);
    assert.deepEqual(rows.get(fid("a")), { aggregate: agg(1), version: "t1", exists: true });
    assert.deepEqual(rows.get(fid("missing")), { aggregate: null, version: null, exists: false });
    assert.equal(rows.has(fid("untouched")), false, "never asked for, never returned");
  });

  test("readFactRowsVersioned: empty id list short-circuits without a query", async () => {
    activeTable.exists = false; // would report migrated:false if it queried at all
    const { rows, migrated } = await readFactRowsVersioned(USER, []);
    assert.equal(migrated, true);
    assert.equal(rows.size, 0);
  });

  test("readFactRowsVersioned: table absent → migrated:false", async () => {
    activeTable.exists = false;
    const { migrated } = await readFactRowsVersioned(USER, [fid("a")]);
    assert.equal(migrated, false);
  });

  test("readFactRowVersioned narrows to one fact", async () => {
    activeTable.userRows(USER).set("a", { aggregate: agg(1), updated_at: "t1" });
    const row = await readFactRowVersioned(USER, fid("a"));
    assert.deepEqual(row, { aggregate: agg(1), version: "t1", exists: true });
  });

  test("factsTableMigrated reflects whether the table exists", async () => {
    assert.equal(await factsTableMigrated(USER), true);
    activeTable.exists = false;
    assert.equal(await factsTableMigrated(USER), false);
  });
});

describe("progress_facts: writeFactRowGuarded — per-fact CAS", () => {
  beforeEach(() => {
    activeTable = new FakeFactsTable();
  });

  test("inserts when the fact has no row yet", async () => {
    const ok = await writeFactRowGuarded(USER, fid("a"), agg(1), { aggregate: null, version: null, exists: false });
    assert.equal(ok, true);
    assert.deepEqual(activeTable.userRows(USER).get("a")?.aggregate, agg(1));
  });

  test("a concurrent first-write race on the SAME fact: only one insert lands", async () => {
    const [a, b] = await Promise.all([
      writeFactRowGuarded(USER, fid("a"), agg(1), { aggregate: null, version: null, exists: false }),
      writeFactRowGuarded(USER, fid("a"), agg(2), { aggregate: null, version: null, exists: false }),
    ]);
    assert.notEqual(a, b);
  });

  test("guarded update lands when the version still matches, and moves the token forward", async () => {
    await writeFactRowGuarded(USER, fid("a"), agg(1), { aggregate: null, version: null, exists: false });
    const seeded = activeTable.userRows(USER).get("a")!;
    const ok = await writeFactRowGuarded(USER, fid("a"), agg(2), {
      aggregate: agg(1),
      version: seeded.updated_at,
      exists: true,
    });
    assert.equal(ok, true);
    const after = activeTable.userRows(USER).get("a")!;
    assert.deepEqual(after.aggregate, agg(2));
    assert.ok(Date.parse(after.updated_at) > Date.parse(seeded.updated_at));
  });

  test("a stale version is rejected — the row is left untouched", async () => {
    await writeFactRowGuarded(USER, fid("a"), agg(1), { aggregate: null, version: null, exists: false });
    const ok = await writeFactRowGuarded(USER, fid("a"), agg(99), {
      aggregate: agg(1),
      version: "2020-01-01T00:00:00.000Z",
      exists: true,
    });
    assert.equal(ok, false);
    assert.deepEqual(activeTable.userRows(USER).get("a")?.aggregate, agg(1));
  });

  test("writing DIFFERENT facts never contends, even concurrently", async () => {
    const [a, b] = await Promise.all([
      writeFactRowGuarded(USER, fid("a"), agg(1), { aggregate: null, version: null, exists: false }),
      writeFactRowGuarded(USER, fid("b"), agg(2), { aggregate: null, version: null, exists: false }),
    ]);
    assert.equal(a, true);
    assert.equal(b, true);
  });
});

describe("progress_facts: deletes, replace, and the pre-migration fallback", () => {
  beforeEach(() => {
    activeTable = new FakeFactsTable();
    activeTable.userRows(USER).set("a", { aggregate: agg(1), updated_at: "t1" });
    activeTable.userRows(USER).set("b", { aggregate: agg(2), updated_at: "t2" });
  });

  test("deleteFactRows removes only the named ids", async () => {
    const { migrated } = await deleteFactRows(USER, [fid("a")]);
    assert.equal(migrated, true);
    assert.equal(activeTable.userRows(USER).has("a"), false);
    assert.ok(activeTable.userRows(USER).has("b"));
  });

  test("deleteFactRows: table absent → migrated:false, nothing thrown", async () => {
    activeTable.exists = false;
    const { migrated } = await deleteFactRows(USER, [fid("a")]);
    assert.equal(migrated, false);
  });

  test("deleteAllFactRows wipes every row for the user", async () => {
    await deleteAllFactRows(USER);
    assert.equal(activeTable.userRows(USER).size, 0);
  });

  test("deleteAllFactRows: table absent is a silent no-op, not a throw", async () => {
    activeTable.exists = false;
    await assert.doesNotReject(() => deleteAllFactRows(USER));
  });

  test("replaceAllFactRows replaces the whole set — old ids not in the new set are gone", async () => {
    const { migrated } = await replaceAllFactRows(USER, { c: agg(3) } as unknown as Record<
      import("@/types").FactId,
      import("@/types").FactAggregate
    >);
    assert.equal(migrated, true);
    const rows = activeTable.userRows(USER);
    assert.equal(rows.has("a"), false);
    assert.equal(rows.has("b"), false);
    assert.deepEqual(rows.get("c")?.aggregate, agg(3));
  });

  test("replaceAllFactRows: table absent → migrated:false, nothing written", async () => {
    activeTable.exists = false;
    const { migrated } = await replaceAllFactRows(USER, { c: agg(3) } as unknown as Record<
      import("@/types").FactId,
      import("@/types").FactAggregate
    >);
    assert.equal(migrated, false);
  });
});
