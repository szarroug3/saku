// Splitting the Atlas and putting it back gives the Atlas (SAK-381).
//
// The Atlas no longer sends its tiles or its shelves. It sends the difference
// from a catalogue the browser already has, and the browser joins the two.
// That is only allowed to be faster, never different, so this builds the
// Atlas the old way for several learners and asserts the split-then-joined
// one is the same thing, field for field, in order.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyHistory } from "@/lib/history-ops";
import type { FactId, HistoryFile } from "@/types";

import { atlasFromHistory } from "./atlas";
import { atlasCatalogue, splitAtlas } from "./atlas-catalogue";
import { joinAtlas } from "./atlas-payload";
import { sampleHistory } from "./sample-learner";

const NOW = Date.UTC(2026, 8, 6);
const wire = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** A learner partway through: a kana solid, one slipping, a kanji claimed. */
function partway(): HistoryFile {
  const h = emptyHistory();
  const day = 24 * 60 * 60 * 1000;
  h.facts["kana:あ/reading" as FactId] = { seen: 4, missed: 0, last: NOW - day, ease: 2.5, interval: 6, due: NOW + 6 * day } as never;
  h.facts["kana:い/reading" as FactId] = { seen: 2, missed: 2, last: NOW - day, ease: 1.8, interval: 1, due: NOW - day } as never;
  h.claims = { "kanji:一/meaning": NOW - day } as never;
  return h;
}

describe("the Atlas splits and joins back to itself", () => {
  const cases: readonly (readonly [string, () => HistoryFile])[] = [
    ["a learner with a history", sampleHistory],
    ["a learner who has never opened it", emptyHistory],
    ["a learner partway in", partway],
  ];

  for (const [name, make] of cases) {
    it(`is the same Atlas for ${name}`, () => {
      const original = atlasFromHistory(make(), NOW);
      const catalogue = wire(atlasCatalogue());
      const payload = wire(splitAtlas(original, atlasCatalogue()));
      assert.deepEqual(wire(joinAtlas(catalogue, payload)), wire(original));
    });
  }

  it("sends the standings and the counts, and nothing else of any size", () => {
    const payload = splitAtlas(atlasFromHistory(sampleHistory(), NOW));
    assert.deepEqual(payload.extras, []);
    assert.equal(payload.shelves, undefined);
    const before = JSON.stringify(atlasFromHistory(sampleHistory(), NOW)).length;
    const after = JSON.stringify(payload).length;
    assert.ok(after * 20 < before, `${after} bytes is not much smaller than ${before}`);
  });

  it("gives a learner with nothing almost nothing", () => {
    const payload = splitAtlas(atlasFromHistory(emptyHistory(), NOW));
    assert.deepEqual(payload.standings, {});
    assert.ok(JSON.stringify(payload).length < 2_000, `${JSON.stringify(payload).length} bytes for an empty Atlas`);
  });

  it("names its own version, not the sky's", async () => {
    const { skyCatalogue } = await import("./catalogue");
    assert.notEqual(atlasCatalogue().version, skyCatalogue().version);
    assert.match(atlasCatalogue().version, /\.[0-9a-f]{12}$/);
  });
});
