// The coverage bar's shares are honest: drawn against the whole collection.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coverageSegments, knownCount } from "@/sky/lib/coverage";

describe("coverage segments", () => {
  it("draws against the whole collection, with the rest untouched", () => {
    const { segments, untouched, overflow } = coverageSegments({ solid: 27, "getting-there": 1, shaky: 1, slipping: 1, claimed: 2 }, 2104);
    assert.deepEqual(segments.map((s) => s.standing), ["solid", "getting-there", "shaky", "slipping", "claimed"]);
    assert.equal(untouched, 2104 - 32);
    assert.equal(overflow, 0);
    const drawn = segments.reduce((sum, s) => sum + s.share, 0);
    assert.ok(Math.abs(drawn - 32 / 2104) < 1e-12, "the segments cover exactly the seen share");
  });

  it("leaves out empty segments, keeps the order, and never collapses at zero", () => {
    const { segments, untouched } = coverageSegments({ solid: 0, shaky: 3 }, 10);
    assert.deepEqual(segments.map((s) => s.standing), ["shaky"]);
    assert.equal(untouched, 7);
    assert.deepEqual(coverageSegments({}, 10), { segments: [], untouched: 10, overflow: 0 });
    assert.deepEqual(coverageSegments({}, 0), { segments: [], untouched: 0, overflow: 0 });
    assert.deepEqual(coverageSegments({ solid: 5 }, 0).segments, [], "no collection, nothing to draw against");
  });

  it("counts past the total scale down together and are reported", () => {
    const { segments, untouched, overflow } = coverageSegments({ solid: 8, shaky: 4 }, 6);
    assert.equal(overflow, 6);
    assert.equal(untouched, 0);
    assert.ok(Math.abs(segments.reduce((sum, s) => sum + s.share, 0) - 1) < 1e-12);
    assert.ok(Math.abs(segments[0].share / segments[1].share - 2) < 1e-12, "proportions kept");
  });

  it("not seen is never a segment, since it is what the track already shows", () => {
    const { segments, untouched } = coverageSegments({ "not-seen": 50, solid: 1 }, 10);
    assert.deepEqual(segments.map((s) => s.standing), ["solid"]);
    assert.equal(untouched, 9);
  });

  it("known is solid or claimed", () => {
    assert.equal(knownCount({ solid: 27, claimed: 2, shaky: 9 }), 29);
    assert.equal(knownCount({}), 0);
  });
});
