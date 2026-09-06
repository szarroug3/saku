// Splitting the sky and putting it back gives the sky (SAK-381).
//
// The home no longer sends its stars. It sends the difference from a
// catalogue the browser already has, and the browser joins the two. That is
// only allowed to be faster, never different, so this builds the sky the old
// way for several learners and asserts the split-then-joined one is the same
// thing, field for field.
//
// Compared through JSON on both sides on purpose: the payload crosses the
// wire, and an absent key and a key set to undefined are the same star.
//
// `items` is compared as a map rather than a list. The catalogue's order is
// its own and a learner's tail is theirs, so the two arrays hold the same
// stars in a different order, and on the home that order is not read: what is
// drawn comes off `roots` and `firmament`, whose order IS compared exactly.
// The last test proves the drawing rather than assuming it, by building the
// prerequisite graph from both and walking every constellation the sky shows.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyHistory } from "@/lib/history-ops";
import { getStatsRows } from "@/lib/library/server-lookups";
import { buildGraph } from "@/sky/lib/graph";
import type { SkyHomeData } from "@/sky/components/sky-home";

import { skyCatalogue, splitSky } from "./catalogue";
import { skyFromHistory } from "./learner";
import { beyondWords } from "./observatory";
import { sampleHistory } from "./sample-learner";
import { joinSky } from "./sky-payload";
import type { FactId, HistoryFile } from "@/types";

const NOW = Date.UTC(2026, 8, 6);
const wire = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** The sky as everything but its item list, plus that list keyed by id. */
function comparable(data: SkyHomeData) {
  const { items, ...rest } = wire(data);
  return { ...rest, items: Object.fromEntries(items.map((i) => [i.id, i])) };
}

async function skyFor(history: HistoryFile): Promise<SkyHomeData> {
  return skyFromHistory(history, NOW, await getStatsRows(), { everything: true, beyond: beyondWords });
}

/** A learner partway through: some kana solid, a kanji seen, a word claimed. */
function partway(): HistoryFile {
  const h = emptyHistory();
  const day = 24 * 60 * 60 * 1000;
  h.facts["kana:あ/reading" as FactId] = { seen: 4, missed: 0, last: NOW - day, ease: 2.5, interval: 6, due: NOW + 6 * day } as never;
  h.facts["kana:い/reading" as FactId] = { seen: 2, missed: 2, last: NOW - day, ease: 1.8, interval: 1, due: NOW - day } as never;
  h.claims = { "kanji:一/meaning": NOW - day } as never;
  h.seen = { "kanji:二/meaning": NOW - day } as never;
  return h;
}

describe("the sky splits and joins back to itself", () => {
  const cases: readonly (readonly [string, () => HistoryFile])[] = [
    ["a learner with a history", sampleHistory],
    ["a learner who has never opened it", emptyHistory],
    ["a learner partway in", partway],
  ];

  for (const [name, make] of cases) {
    it(`is the same sky for ${name}`, async () => {
      const original = await skyFor(make());
      const catalogue = wire(skyCatalogue());
      const payload = wire(splitSky(original, skyCatalogue()));
      assert.deepEqual(comparable(joinSky(catalogue, payload)), comparable(original));
    });
  }

  it("sends a fraction of what it used to", async () => {
    const original = await skyFor(sampleHistory());
    const payload = splitSky(original);
    const before = JSON.stringify(original).length;
    const after = JSON.stringify(payload).length;
    assert.ok(after * 20 < before, `${after} bytes is not much smaller than ${before}`);
  });

  it("gives a learner with nothing almost nothing", async () => {
    const payload = splitSky(await skyFor(emptyHistory()));
    assert.deepEqual(payload.extras, []);
    assert.deepEqual(payload.standings, {});
    assert.ok(JSON.stringify(payload).length < 20_000, `${JSON.stringify(payload).length} bytes for an empty sky`);
  });

  it("draws the same sky: every constellation it shows, star for star", async () => {
    // The proof that the item list's order does not matter here. The home
    // renders what `roots` and `firmament` name, through the graph, so build
    // the graph both ways and walk each of them.
    const original = await skyFor(sampleHistory());
    const joined = joinSky(wire(skyCatalogue()), wire(splitSky(original)));
    const before = buildGraph(original.items);
    const after = buildGraph(joined.items);
    const shown = [...new Set([...original.roots, ...(original.firmament ?? [])])];
    assert.ok(shown.length > 1000, `only ${shown.length} stars shown`);
    for (const id of shown) {
      assert.deepEqual(after.constellationOf(id), before.constellationOf(id), id);
      assert.deepEqual(after.orderOf(id), before.orderOf(id), id);
      assert.deepEqual(after.prerequisitesOf(id), before.prerequisitesOf(id), id);
    }
  });

  it("names a version that changes with the catalogue and not with the clock", () => {
    assert.equal(skyCatalogue().version, skyCatalogue().version);
    assert.match(skyCatalogue().version, /\.[0-9a-f]{12}$/);
  });
});
