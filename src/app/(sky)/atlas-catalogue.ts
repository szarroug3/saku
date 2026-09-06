// The Atlas's catalogue: every tile and shelf this build could show, without
// a learner (SAK-381). The server half of atlas-payload.ts.
//
// Built the same way the sky's is: by running the real pipeline against an
// empty history, so a tile cannot be shaped one way here and another way on a
// learner's own Atlas.

import { emptyHistory } from "@/lib/history-ops";
import type { AtlasShelf, SkyAtlasData } from "@/sky/components/sky-atlas";

import { atlasFromHistory } from "./atlas";
import { versionOf } from "./catalogue-version";
import { splitItems, withoutStanding } from "./item-split";
import type { AtlasCatalogue, AtlasPayload, AtlasShelfBase } from "./atlas-payload";

/** Nothing in an empty history ages, so the clock only has to be the same
 * number every time: a catalogue that changed with the hour would be a new
 * download every hour. */
const NO_CLOCK = 0;

let built: AtlasCatalogue | null = null;

export function atlasCatalogue(): AtlasCatalogue {
  if (built) return built;
  const empty = atlasFromHistory(emptyHistory(), NO_CLOCK);
  const items = empty.items.map(withoutStanding);
  const shelves = empty.shelves.map(withoutCounts);
  built = { version: versionOf(JSON.stringify({ items, shelves })), items, shelves, holds: empty.holds };
  return built;
}

function withoutCounts(shelf: AtlasShelf): AtlasShelfBase {
  const { counts: _counts, ...rest } = shelf;
  return rest;
}

/** One learner's Atlas as its difference from the catalogue. The inverse of
 * `joinAtlas`, and `atlas-payload.test.ts` holds the two together. */
export function splitAtlas(data: SkyAtlasData, catalogue = atlasCatalogue()): AtlasPayload {
  const base = { version: catalogue.version, ...splitItems(data.items, catalogue.items) };
  // The shelves are the same ten in the same order for everybody, so only
  // their counts travel. If that ever stops being true they travel whole,
  // the way an item that does not match the catalogue does.
  const same =
    data.shelves.length === catalogue.shelves.length &&
    data.shelves.every((s, i) => JSON.stringify(withoutCounts(s)) === JSON.stringify(catalogue.shelves[i]));
  if (!same) return { ...base, counts: [], shelves: data.shelves };
  return { ...base, counts: data.shelves.map((s) => s.counts) };
}
