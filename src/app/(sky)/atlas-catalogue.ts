// The Atlas's catalogue: every tile and shelf this build could show, without
// a learner (SAK-381). The server half of atlas-payload.ts.
//
// Built the same way the sky's is: by running the real pipeline against an
// empty history, so a tile cannot be shaped one way here and another way on a
// learner's own Atlas.

import { emptyHistory } from "@/lib/history-ops";
import { libEntry, type LibEntry } from "@/lib/library/entries";
import type { Standing } from "@/sky/lib/standing";
import type { EntryId, HistoryFile } from "@/types";
import type { AtlasShelf, SkyAtlasData } from "@/sky/components/sky-atlas";

import { all, atlasFromHistory, countsOver, SHELVES } from "./atlas";
import { standingFor } from "./learner";
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

/**
 * One learner's Atlas payload, worked out directly (SAK-382).
 *
 * `splitAtlas(atlasFromHistory(h))` gets the same answer, and did until now,
 * but it builds 2,815 tiles and ten shelves of section lists first and then
 * throws all of them away, because the catalogue already holds them and only
 * the standings and the counts differ. On the deployed function that build
 * measured 643 ms, five times what the database costs now.
 *
 * So this asks the catalogue what it holds and works out only what a learner
 * changes about it. `atlas-payload.test.ts` runs both over several learners
 * and asserts they agree exactly, including that the direct route never needs
 * `extras` — which is the one thing it cannot discover for itself, since it
 * never builds a tile to compare.
 */
export function atlasPayloadFor(history: HistoryFile, now = Date.now(), catalogue = atlasCatalogue()): AtlasPayload {
  const standings: Record<string, Standing> = {};
  for (const item of catalogue.items) {
    const entry = libEntry(item.id as EntryId);
    if (!entry) continue;
    const { standing } = standingFor(entry, history, now);
    if (standing !== "not-seen") standings[item.id] = standing;
  }
  return {
    version: catalogue.version,
    standings,
    extras: [],
    counts: catalogue.shelves.map((shelf) => countsOver(shelvesByKind(shelf.id), history, now)),
  };
}

/** The entries a shelf counts over, held for the life of the process: the
 * shelf's kinds are fixed and `all` is already memoised. */
const byShelf = new Map<string, readonly LibEntry[]>();
function shelvesByKind(shelfId: string): readonly LibEntry[] {
  const known = byShelf.get(shelfId);
  if (known) return known;
  const shelf = SHELVES.find((s) => s.id === shelfId);
  const entries = shelf ? shelf.kinds.flatMap(all) : [];
  byShelf.set(shelfId, entries);
  return entries;
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
