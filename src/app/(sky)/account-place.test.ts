// What a SIGNED-IN learner is offered back (SAK-444).
//
// The e2e suite runs signed out, so everything it proves about coming back to
// a lesson it proves about the browser's copy. This is the other half: the
// account's `session` column, read the way `loadPlace` reads it and turned
// into the words the Observatory's one button says.
//
// `loadPlace` itself is two lines, `readPlace(await readSessionRow(userId))`
// over whoever is signed in, and the user is the auth layer's to answer. So
// this drives everything under that one line: the real read primitive against
// a fake `progress` table, the real reader, and the real label. Sam's own
// note on the card is that the button must show for a signed-in learner and
// not only for a visitor, and without this nothing anywhere says so.
//
// The fake table is the smallest thing that answers what the primitive asks:
// one row per user, `select(...).eq(...).maybeSingle()` answering null for a
// user with no row, and an upsert that touches the columns it names.
//
// Run with:
//   node --conditions=react-server --experimental-test-module-mocks \
//     --import ./src/lib/conjugate/test-hooks.mjs --test \
//     "src/app/(sky)/account-place.test.ts"

import assert from "node:assert/strict";
import { before, beforeEach, describe, mock, test } from "node:test";

import { newestPlace, placeDoc, placeEntries, placeLabel, readPlace, type SavedPlace } from "@/sky/lib/place";
import type { SavedRun } from "@/sky/lib/quiz-run";

interface FakeRow {
  user_id: string;
  history: unknown;
  settings: unknown;
  session: unknown;
  updated_at: string | null;
}

class FakeProgressTable {
  rows = new Map<string, FakeRow>();

  from(name: string) {
    assert.equal(name, "progress");
    return this;
  }

  select(cols: string) {
    return new Query(this, cols);
  }

  upsert(payload: Record<string, unknown>, options: { onConflict: string }) {
    assert.equal(options.onConflict, "user_id");
    const userId = payload.user_id as string;
    const had = this.rows.get(userId) ?? { user_id: userId, history: null, settings: null, session: null, updated_at: null };
    this.rows.set(userId, { ...had, ...(payload as Partial<FakeRow>) });
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

  maybeSingle() {
    const row = this.#userId ? this.#table.rows.get(this.#userId) : undefined;
    if (!row) return Promise.resolve({ data: null, error: null });
    const picked: Record<string, unknown> = {};
    for (const col of this.#cols.split(",").map((c) => c.trim())) picked[col] = (row as unknown as Record<string, unknown>)[col];
    return Promise.resolve({ data: picked, error: null });
  }
}

let table: FakeProgressTable;

before(() => {
  mock.module("@/lib/supabase/server", {
    namedExports: {
      createSupabaseServerClient: async () => ({ from: (name: string) => table.from(name) }),
    },
  });
});

const { readSessionRow, writeSessionRow } = await import("@/lib/store/supabase-store.ts");

const USER = "user-1";
const NOW = 5_000_000;
const PICKS = ["kana-row:h-w"];
const RUN: SavedRun = {
  deck: ["a", "b", "c", "d"],
  at: 3,
  answers: [{ cardId: "a", grade: "clean", tries: 1, narrowed: false, hinted: false }],
  from: { picks: PICKS },
  leftAt: 20,
};

describe("what a signed-in learner's account offers back", () => {
  beforeEach(() => {
    table = new FakeProgressTable();
  });

  /** `loadPlace`, with the auth layer taken as read. */
  const loaded = async () => readPlace(await readSessionRow(USER));
  /** What the Observatory and the Planetarium put on their one button. */
  const offered = async () => {
    const entry = newestPlace(await loaded());
    return entry ? placeLabel(entry, NOW) : null;
  };
  const keep = (place: SavedPlace) => writeSessionRow(USER, placeDoc(place));

  test("offers nothing when the column has never been written", async () => {
    assert.equal(await offered(), null);
  });

  test("offers a lesson left on its steps, the first step included", async () => {
    await keep({ quiz: null, lesson: { picks: PICKS, part: { kind: "steps", at: 0, steps: 9, star: "kana:わ" }, leftAt: 10 } });
    assert.equal(await offered(), "Continue your lesson (step 1 of 9)");
  });

  test("offers a lesson left in a round of its drill, at the card it was left on", async () => {
    await keep({ quiz: null, lesson: { picks: PICKS, part: { kind: "round", round: 2, run: RUN }, leftAt: 20 } });
    assert.equal(await offered(), "Continue your lesson (round 2, card 4 of 4)");
  });

  test("offers a lesson left in a break, counted against the reader's own clock", async () => {
    await keep({ quiz: null, lesson: { picks: PICKS, part: { kind: "break", round: 1, startedAt: NOW, until: NOW + 300_000 }, leftAt: 30 } });
    assert.equal(await offered(), "Continue your lesson (break before round 2 of 3, 5 min left)");
  });

  test("offers the newer of the two, and Sessions still has the other", async () => {
    await keep({ quiz: { ...RUN, leftAt: 40 }, lesson: { picks: PICKS, part: { kind: "steps", at: 1, steps: 9, star: "kana:わ" }, leftAt: 50 } });
    assert.equal(await offered(), "Continue your lesson (step 2 of 9)");
    assert.deepEqual(placeEntries(await loaded()).map((e) => e.kind), ["lesson", "quiz"]);
  });

  test("offers a learner caught mid-sitting by either older shape of the document", async () => {
    // version 1, SAK-404's bare run written straight into the column
    await writeSessionRow(USER, RUN);
    assert.equal(await offered(), "Continue your quiz (1 of 4)");
    // version 2, the lesson as a step and nothing else
    await writeSessionRow(USER, { v: 2, lesson: { picks: PICKS, at: 2, steps: 9, star: "kana:わ", leftAt: 60 } });
    assert.equal(await offered(), "Continue your lesson (step 3 of 9)");
  });

  test("offers nothing again once the sitting is over and the column is cleared", async () => {
    await keep({ quiz: null, lesson: { picks: PICKS, part: { kind: "steps", at: 1, steps: 9, star: "kana:わ" }, leftAt: 10 } });
    await keep({ quiz: null, lesson: null });
    assert.equal(table.rows.get(USER)!.session, null);
    assert.equal(await offered(), null);
  });
});
