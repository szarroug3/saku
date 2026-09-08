// The Atlas's catalogue: every tile and shelf this build could show, without
// a learner (SAK-381). The server half of atlas-payload.ts.
//
// Built the same way the sky's is: by running the real pipeline against an
// empty history, so a tile cannot be shaped one way here and another way on a
// learner's own Atlas.

import atlasCatalogueJson from "@/data/generated/atlas-catalogue.json" with { type: "json" };
import { libEntry, type LibEntry } from "@/lib/library/entries";
import type { CoverageCounts } from "@/sky/lib/coverage";
import type { Standing } from "@/sky/lib/standing";
import type { EntryId, HistoryFile } from "@/types";
import type { SkyAtlasData } from "@/sky/components/sky-atlas";

import { all, countsOver, SHELVES } from "./atlas";
import { timedSync } from "@/lib/server-timing";
import { sparse, standingFor, touchedEntries } from "./learner";
import { splitItems } from "./item-split";
import type { AtlasCatalogue, AtlasPayload } from "./atlas-payload";
import { withoutCounts } from "./catalogue-build";

/** Nothing in an empty history ages, so the clock only has to be the same
 * number every time: a catalogue that changed with the hour would be a new
 * download every hour. */
/** Every tile and shelf, from the file scripts/build-catalogues.mjs wrote
 * (the building is in catalogue-build.ts). It was built as this module
 * loaded, and on the function that is the first request's time (SAK-399). */
const built: AtlasCatalogue = atlasCatalogueJson as AtlasCatalogue;

export function atlasCatalogue(): AtlasCatalogue {
  return built;
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
 * `extras`, which is the one thing it cannot discover for itself, since it
 * never builds a tile to compare.
 */
export function atlasPayloadFor(history: HistoryFile, now = Date.now(), catalogue = atlasCatalogue()): AtlasPayload {
  const standings: Record<string, Standing> = {};
  // over the entries the history touches, not every tile (SAK-382): the
  // rest are "not-seen" and are not sent
  timedSync("atlas:standings", () => {
    const take = (id: string, entry: LibEntry) => {
      const { standing } = standingFor(entry, history, now);
      if (standing !== "not-seen") standings[id] = standing;
    };
    if (sparse(history)) {
      // in the tiles' order, as they were
      const tiles = tileOrder(catalogue);
      const mine = [...touchedEntries(history)].filter(([id]) => tiles.has(id)).sort((a, b) => tiles.get(a[0])! - tiles.get(b[0])!);
      for (const [id, entry] of mine) take(id, entry);
    } else {
      for (const item of catalogue.items) { const entry = libEntry(item.id as EntryId); if (entry) take(item.id, entry); }
    }
  });
  return {
    version: catalogue.version,
    standings,
    extras: [],
    counts: timedSync("atlas:counts", () => catalogue.shelves.map((shelf) => countsOverTouched(shelf.id, history, now))),
  };
}

/** Where each tile sits in a catalogue, once per catalogue. */
const tileOrderOf = new WeakMap<AtlasCatalogue, ReadonlyMap<string, number>>();
function tileOrder(catalogue: AtlasCatalogue): ReadonlyMap<string, number> {
  let order = tileOrderOf.get(catalogue);
  if (!order) { order = new Map(catalogue.items.map((it, i) => [it.id, i])); tileOrderOf.set(catalogue, order); }
  return order;
}

/** The ids of the entries a shelf counts over, once per shelf. */
const idsByShelf = new Map<string, ReadonlySet<string>>();
function shelfIds(shelfId: string): ReadonlySet<string> {
  let ids = idsByShelf.get(shelfId);
  if (!ids) { ids = new Set(shelvesByKind(shelfId).map((e) => e.id)); idsByShelf.set(shelfId, ids); }
  return ids;
}

/** `countsOver` for a shelf, walking the touched entries that are on it
 * rather than the shelf: the untouched ones are "not-seen", which the
 * counts leave out anyway. */
function countsOverTouched(shelfId: string, history: HistoryFile, now: number): CoverageCounts {
  if (!sparse(history)) return countsOver(shelvesByKind(shelfId), history, now);
  const ids = shelfIds(shelfId);
  const counts: CoverageCounts = {};
  for (const [id, e] of touchedEntries(history)) {
    if (!ids.has(id)) continue;
    const s = standingFor(e, history, now).standing;
    if (s !== "not-seen") counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
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
