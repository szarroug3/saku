import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  SHAKY_BANDS,
  activePreset,
  everythingSelection,
  listSelection,
  shakySelection,
} from "@/lib/practice-presets";
import { emptySelection } from "@/lib/selection-empty";
import type { Selection } from "@/types";

// The presets are pure Selection values, and the only behaviour worth locking is
// the round trip: a preset's selection must read back AS that preset, and a
// selection that is anything more than a preset must read back as "custom" so a
// tile never mislabels a richer query.

describe("preset selections are the empty query, narrowed one way", () => {
  test("everything is the empty query", () => {
    assert.deepEqual(everythingSelection(), emptySelection());
  });

  test("shaky narrows only the bands", () => {
    const sel = shakySelection();
    assert.deepEqual(sel.states, [...SHAKY_BANDS]);
    assert.deepEqual(sel.subjects, []);
    assert.equal(sel.list, null);
    assert.equal(sel.text, "");
    assert.equal(sel.session, null);
  });

  test("list narrows only the list", () => {
    const sel = listSelection("l1");
    assert.equal(sel.list, "l1");
    assert.deepEqual(sel.states, []);
    assert.deepEqual(sel.subjects, []);
  });
});

describe("activePreset reads a selection back to its preset", () => {
  const listIds = ["l1", "l2"];

  test("the empty query is everything", () => {
    assert.deepEqual(activePreset(everythingSelection(), listIds), {
      kind: "everything",
    });
  });

  test("the shaky query is shaky, band order aside", () => {
    const reordered: Selection = {
      ...emptySelection(),
      states: ["mixup", "shaky", "slipping"],
    };
    assert.deepEqual(activePreset(reordered, listIds), { kind: "shaky" });
  });

  test("a saved-list query names its list", () => {
    assert.deepEqual(activePreset(listSelection("l2"), listIds), {
      kind: "list",
      listId: "l2",
    });
  });

  test("a list not among the known ids is not a list preset", () => {
    assert.deepEqual(activePreset(listSelection("gone"), listIds), {
      kind: "custom",
    });
  });

  test("anything richer than a preset is custom", () => {
    // A shaky band PLUS a subject filter is a Library query, not the shaky tile.
    const richer: Selection = {
      ...emptySelection(),
      states: [...SHAKY_BANDS],
      subjects: ["kanji"],
    };
    assert.deepEqual(activePreset(richer, listIds), { kind: "custom" });
  });

  test("a partial band set is not the shaky preset", () => {
    const partial: Selection = { ...emptySelection(), states: ["shaky"] };
    assert.deepEqual(activePreset(partial, listIds), { kind: "custom" });
  });
});
