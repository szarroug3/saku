// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/lists-mutate.test.ts
//
// THE BUG THESE PIN (SAK-220)
// ===========================
// List writes had no concurrency guard — each one loaded the row, edited the
// loaded copy, and upserted the WHOLE blob back, so the later of two overlapping
// writes won and the other's lists were simply gone. The worst case is a wipe,
// not a dropped edit: two devices signing into the same account within the same
// second each replay their own signed-out lists (store/migrate-local.ts), both
// read the same empty row, and the loser's lists vanish from the server. Both
// requests answered 2xx, so both devices then cleared their local copy and the
// loser's lists were unrecoverable.
//
// mutateListsWithRetry closes it with the same optimistic concurrency history
// has: a write lands only if the row still carries the token the read saw, and a
// miss re-reads the winner and re-applies. The first test is the two-device race
// itself — device A's three lists and device B's two must ALL survive.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  withListDeleted,
  withListEntriesAdded,
  withListRenamed,
  withListSaved,
} from "@/lib/list-ops";
import {
  mutateListsWithRetry,
  type ListsStore,
  type ListsVersionedRead,
} from "@/lib/lists-mutate";
import type { EntryId, ListsFile, SavedList } from "@/types";

const USER = "user-1";

function list(id: string, entries: string[] = []): SavedList {
  return {
    kind: "fixed",
    id,
    name: id,
    created: 1,
    entries: entries as EntryId[],
    origin: "manual",
  };
}

const emptyLists = (): ListsFile => ({ lists: [] });

/**
 * An in-memory store that models the real compare-and-set exactly: a write lands
 * only if the row still carries the token the caller read (or, for the first
 * row, only if none exists yet). `onRead` fires ONCE, right after a read
 * snapshots the state and before it returns — the hook a test uses to run a
 * competing writer "in between", which is how a real overlap is reproduced
 * deterministically. Modelled on history-mutate.test.ts's CasStore.
 */
class CasStore implements ListsStore {
  state: { lists: ListsFile; version: string | null; exists: boolean };
  seq = 0;
  reads = 0;
  writeAttempts = 0;
  conflicts = 0;
  onRead?: () => Promise<void>;

  constructor(seed?: { lists: ListsFile; version: string }) {
    this.state = seed
      ? { lists: seed.lists, version: seed.version, exists: true }
      : { lists: emptyLists(), version: null, exists: false };
  }

  async read(): Promise<ListsVersionedRead> {
    this.reads++;
    const snapshot: ListsVersionedRead = {
      lists: structuredClone(this.state.lists),
      version: this.state.version,
      exists: this.state.exists,
    };
    const hook = this.onRead;
    if (hook) {
      this.onRead = undefined;
      await hook();
    }
    return snapshot;
  }

  async write(
    _userId: string,
    next: ListsFile,
    expected: ListsVersionedRead,
  ): Promise<boolean> {
    this.writeAttempts++;
    const wins = expected.exists
      ? this.state.exists && this.state.version === expected.version
      : !this.state.exists;
    if (!wins) {
      this.conflicts++;
      return false;
    }
    this.state = {
      lists: structuredClone(next),
      version: `v${++this.seq}`,
      exists: true,
    };
    return true;
  }
}

/** A device replaying its signed-out lists at sign-in: one whole-list save per
 * list, exactly what migrate-local.ts's replayLists POSTs. */
async function replay(store: ListsStore, lists: SavedList[]): Promise<void> {
  for (const l of lists) {
    await mutateListsWithRetry(store, USER, (file) => withListSaved(file, l));
  }
}

const ids = (file: ListsFile) => file.lists.map((l) => l.id).sort();

describe("two devices signing in at the same second (SAK-220)", () => {
  test("device A's lists and device B's lists both survive", async () => {
    // No row yet — the state both devices read when a brand-new account is
    // created by whichever sign-in got there first.
    const store = new CasStore();
    const deviceA = [list("a1"), list("a2"), list("a3")];
    const deviceB = [list("b1"), list("b2")];

    // Device B runs to completion between device A's first read and its write.
    // Pre-fix, A's write was a blind upsert of its own three lists over B's row
    // and B's two lists were destroyed.
    store.onRead = async () => {
      await replay(store, deviceB);
    };

    await replay(store, deviceA);

    assert.deepEqual(
      ids(store.state.lists),
      ["a1", "a2", "a3", "b1", "b2"],
      "every list from both devices is on the account",
    );
    assert.ok(store.conflicts >= 1, "device A lost the CAS at least once and retried");
  });

  test("neither device is told it succeeded unless its lists actually landed", async () => {
    // The clear-local decision hangs on this: mutateListsWithRetry resolves only
    // when the write LANDED, and throws otherwise — it never returns a value that
    // could be read as success for a write that was clobbered.
    const store = new CasStore();
    const a = list("a1");
    store.onRead = async () => {
      await replay(store, [list("b1")]);
    };

    const result = await mutateListsWithRetry(store, USER, (f) => withListSaved(f, a));

    assert.deepEqual(ids(result), ["a1", "b1"], "the resolved file holds both");
    assert.deepEqual(ids(store.state.lists), ["a1", "b1"], "and so does the row");
  });

  test("a write that can never land throws rather than reporting a false success", async () => {
    // Sustained contention: the route turns this into a 500, so the replaying
    // device keeps its local copy instead of clearing it. Silently returning here
    // is the failure mode that made the loss permanent.
    const jammed: ListsStore = {
      read: async () => ({ lists: emptyLists(), version: "x", exists: true }),
      write: async () => false,
    };
    await assert.rejects(
      () => mutateListsWithRetry(jammed, USER, (f) => withListSaved(f, list("a1")), 3),
      /lost to concurrent writers 3 times/,
    );
  });
});

describe("the re-applied op rebuilds on the winner", () => {
  test("an entry add lands on the concurrent writer's file, not over it", async () => {
    const store = new CasStore({
      lists: { lists: [list("mine", ["e1"])] },
      version: "seed",
    });
    store.onRead = async () => {
      await mutateListsWithRetry(store, USER, (f) => withListSaved(f, list("theirs")));
    };

    const result = await mutateListsWithRetry(store, USER, (f) =>
      withListEntriesAdded(f, "mine", ["e2" as EntryId]),
    );

    assert.deepEqual(ids(result), ["mine", "theirs"], "their list survived");
    const mine = result.lists.find((l) => l.id === "mine");
    assert.deepEqual(
      mine?.kind === "fixed" ? mine.entries : [],
      ["e1", "e2"],
      "and our entry was added",
    );
    assert.equal(store.reads, 3, "we read twice (initial + retry); they read once");
  });

  test("a delete removes only our list, never the winner's", async () => {
    const store = new CasStore({
      lists: { lists: [list("doomed")] },
      version: "seed",
    });
    store.onRead = async () => {
      await mutateListsWithRetry(store, USER, (f) => withListSaved(f, list("theirs")));
    };

    const result = await mutateListsWithRetry(store, USER, (f) =>
      withListDeleted(f, "doomed"),
    );

    assert.deepEqual(ids(result), ["theirs"]);
  });
});

describe("contracts preserved", () => {
  test("an edit to a list that isn't there writes nothing and contends for no row", async () => {
    const store = new CasStore({ lists: { lists: [list("a1")] }, version: "seed" });

    const result = await mutateListsWithRetry(store, USER, (f) =>
      withListEntriesAdded(f, "missing", ["e1" as EntryId]),
    );

    assert.equal(store.writeAttempts, 0, "a no-op never touches the row");
    assert.deepEqual(ids(result), ["a1"]);
  });

  test("a rename refused by withName (blank) is a no-op, not a write", async () => {
    const store = new CasStore({ lists: { lists: [list("a1")] }, version: "seed" });
    await mutateListsWithRetry(store, USER, (f) => withListRenamed(f, "a1", "   "));
    assert.equal(store.writeAttempts, 0);
    assert.equal(store.state.lists.lists[0].name, "a1", "the name is untouched");
  });

  test("a delete of an id that is already gone is a no-op", async () => {
    const store = new CasStore({ lists: { lists: [list("a1")] }, version: "seed" });
    await mutateListsWithRetry(store, USER, (f) => withListDeleted(f, "nope"));
    assert.equal(store.writeAttempts, 0);
  });

  test("the first write on an empty row inserts", async () => {
    const store = new CasStore();
    const result = await mutateListsWithRetry(store, USER, (f) =>
      withListSaved(f, list("a1")),
    );
    assert.deepEqual(ids(result), ["a1"]);
    assert.ok(store.state.exists, "the row now exists");
  });

  test("saving a list with an existing id replaces it rather than duplicating", async () => {
    const store = new CasStore({ lists: { lists: [list("a1", ["e1"])] }, version: "seed" });
    const result = await mutateListsWithRetry(store, USER, (f) =>
      withListSaved(f, list("a1", ["e2"])),
    );
    assert.equal(result.lists.length, 1, "still one list");
    const only = result.lists[0];
    assert.deepEqual(only.kind === "fixed" ? only.entries : [], ["e2"]);
  });
});
