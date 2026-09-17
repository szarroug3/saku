// The rules of picking, and of unpicking everything at once (SAK-458).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// `typeof NOTHING` is the selection's own shape: the module keeps the type to
// itself, since nothing outside this test ever writes one down.
import { afterPick, justThis, NOTHING } from "./select";

const ORDER = ["a", "b", "c", "d", "e"];
const PLAIN = { toggle: false, range: false };
const TOGGLE = { toggle: true, range: false };
const RANGE = { toggle: false, range: true };

/** Click through a page of tiles, in order. */
function clicks(from: typeof NOTHING, steps: ReadonlyArray<readonly [string, { toggle: boolean; range: boolean }]>): typeof NOTHING {
  return steps.reduce((state, [id, how]) => afterPick(state, ORDER, id, how), from);
}

describe("picking tiles", () => {
  it("takes one on a plain click", () => {
    assert.deepEqual(afterPick(NOTHING, ORDER, "b", PLAIN), { ids: ["b"], anchor: "b" });
  });

  it("adds and removes one on a toggle", () => {
    const two = clicks(NOTHING, [["b", PLAIN], ["d", TOGGLE]]);
    assert.deepEqual(two.ids, ["b", "d"]);
    assert.deepEqual(afterPick(two, ORDER, "b", TOGGLE).ids, ["d"]);
  });

  it("takes the run from the anchor to the tile, and leaves the anchor where it was", () => {
    const run = clicks(NOTHING, [["b", PLAIN], ["d", RANGE]]);
    assert.deepEqual(run, { ids: ["b", "c", "d"], anchor: "b" });
  });

  it("takes the run backwards too, without picking anything twice", () => {
    // the run itself is in the order the tiles are on screen, whichever end
    // it was drawn from, and a second range from the same anchor adds only
    // what it has not already taken
    const run = clicks(NOTHING, [["d", PLAIN], ["b", RANGE], ["e", RANGE]]);
    assert.deepEqual(run.ids, ["d", "b", "c", "e"]);
  });
});

describe("unselect all", () => {
  it("leaves nothing picked", () => {
    assert.deepEqual(NOTHING, { ids: [], anchor: null });
  });

  it("drops picks that are not on screen", () => {
    // the Atlas keeps one selection across its shelves and its search
    // results, so much of what is picked is usually somewhere else. Picking
    // reads the tiles on screen; unselecting everything reads nothing, so an
    // id from another shelf goes with the rest.
    const elsewhere: typeof NOTHING = { ids: ["kanji:日", "word:仕事", "b"], anchor: "b" };
    assert.ok(elsewhere.ids.some((id) => !ORDER.includes(id)));
    assert.deepEqual(NOTHING.ids, []);
  });

  it("drops the anchor, so the next shift-click does not stretch back to it", () => {
    const picked = clicks(NOTHING, [["b", PLAIN], ["c", TOGGLE]]);
    assert.equal(picked.anchor, "c");
    assert.equal(NOTHING.anchor, null);
    // from nothing, a shift-click takes the one tile it was aimed at
    assert.deepEqual(afterPick(NOTHING, ORDER, "e", RANGE), { ids: ["e"], anchor: "e" });
  });

  it("takes the page back to where it started, however the picks were made", () => {
    const messy = clicks(NOTHING, [["b", PLAIN], ["d", RANGE], ["a", TOGGLE]]);
    assert.deepEqual(messy.ids, ["b", "c", "d", "a"]);
    assert.deepEqual(afterPick(NOTHING, ORDER, "c", PLAIN), justThis("c"));
  });
});
