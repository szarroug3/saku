// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/list-ops.test.ts
//
// The two decisions this screen added, neither of which a type-check can see:
//
//   1. A list ROW is a TOGGLE. The same tick that says "all of these are in
//      here" is what a click uses to take them back out — add when absent or
//      partial, remove only when all present. listToggle is the one place that
//      is decided, so the indicator and the behaviour cannot drift.
//
//   2. Entry writes obey the fixed/derived split. Adding to or removing from a
//      derived list is a no-op — it is a rule, not a set — while a rename lands
//      on either kind, because a name is a label and not a member. And a rename
//      never blanks a name.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { withEntriesAdded, withEntriesRemoved, withName } from "./list-ops.ts";
import { listToggle } from "./use-lists.ts";
import type { EntryId, SavedList } from "../types/index.ts";

const e = (s: string) => s as EntryId;

function fixed(entries: string[]): SavedList {
  return {
    kind: "fixed",
    id: "l1",
    name: "Core",
    created: 0,
    entries: entries.map(e),
    origin: "manual",
  };
}

function derived(): SavedList {
  return {
    kind: "derived",
    id: "d1",
    name: "Kanji I miss",
    created: 0,
    query: {
      subjects: [],
      list: null,
      states: ["shaky"],
      text: "",
      session: null,
    },
    origin: "search",
  };
}

describe("withEntriesAdded", () => {
  test("adds new entries, dedups existing", () => {
    const out = withEntriesAdded(fixed(["か"]), [e("か"), e("き")]);
    assert.deepEqual(out.kind === "fixed" ? out.entries : [], [e("か"), e("き")]);
  });

  test("leaves a derived list untouched", () => {
    const d = derived();
    assert.equal(withEntriesAdded(d, [e("か")]), d);
  });

  test("does not mutate the input", () => {
    const list = fixed(["か"]);
    withEntriesAdded(list, [e("き")]);
    assert.deepEqual(list.kind === "fixed" ? list.entries : [], [e("か")]);
  });
});

describe("withEntriesRemoved", () => {
  test("drops named entries, keeps the rest", () => {
    const out = withEntriesRemoved(fixed(["か", "き", "く"]), [e("き")]);
    assert.deepEqual(out.kind === "fixed" ? out.entries : [], [e("か"), e("く")]);
  });

  test("removing an absent entry is a no-op", () => {
    const out = withEntriesRemoved(fixed(["か"]), [e("ぜ")]);
    assert.deepEqual(out.kind === "fixed" ? out.entries : [], [e("か")]);
  });

  test("leaves a derived list untouched", () => {
    const d = derived();
    assert.equal(withEntriesRemoved(d, [e("か")]), d);
  });
});

describe("withName", () => {
  test("trims and applies a real name", () => {
    assert.equal(withName(fixed([]), "  New name  ").name, "New name");
  });

  test("refuses an empty/whitespace name — keeps the old one", () => {
    assert.equal(withName(fixed([]), "   ").name, "Core");
    assert.equal(withName(fixed([]), "").name, "Core");
  });

  test("renames a derived list too — a name is a label, not a member", () => {
    assert.equal(withName(derived(), "Renamed").name, "Renamed");
  });
});

describe("listToggle", () => {
  test("empty → adds the whole slice", () => {
    const t = listToggle(fixed([]), [e("か"), e("き")]);
    assert.equal(t.kind, "add");
    assert.deepEqual(t.entries, [e("か"), e("き")]);
  });

  test("partial (some present) → adds — a click completes the set", () => {
    const t = listToggle(fixed(["か"]), [e("か"), e("き")]);
    assert.equal(t.kind, "add");
  });

  test("all present → removes — the one place a click undoes", () => {
    const t = listToggle(fixed(["か", "き"]), [e("か"), e("き")]);
    assert.equal(t.kind, "remove");
    assert.deepEqual(t.entries, [e("か"), e("き")]);
  });

  test("single entry toggles in then out over two clicks", () => {
    assert.equal(listToggle(fixed([]), [e("生")]).kind, "add");
    assert.equal(listToggle(fixed(["生"]), [e("生")]).kind, "remove");
  });

  test("a derived list never reads as present — always adds (server then refuses)", () => {
    // countIn returns 0 for a derived list, so the popover would show it blank;
    // it never offers derived rows, but the decision must still be defined.
    assert.equal(listToggle(derived(), [e("か")]).kind, "add");
  });

  test("empty selection → add (nothing to remove)", () => {
    assert.equal(listToggle(fixed(["か"]), []).kind, "add");
  });
});
