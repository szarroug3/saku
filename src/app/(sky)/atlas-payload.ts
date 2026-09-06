// The Atlas, split the way the sky is (SAK-381).
//
// The Atlas sent 530 KB on every request, and between two learners the only
// things that differed were each item's standing and each shelf's counts:
// 2,815 tiles and ten shelves of section lists, 350 KB and 180 KB of them,
// identical for everybody. So the tiles and the shelves go out once as a
// catalogue, cached under a hash of their contents, and what a learner gets
// is the standings and the counts.
//
// The item half is item-split.ts, shared with the home. What is here is the
// shelves.

import type { AtlasShelf, SkyAtlasData } from "@/sky/components/sky-atlas";
import type { CoverageCounts } from "@/sky/lib/coverage";

import { joinItems, type ItemDiff, type SkyItemBase } from "./item-split";

/** A shelf without the part that is one learner's. */
export type AtlasShelfBase = Omit<AtlasShelf, "counts">;

/** Every tile and shelf this build could show. */
export interface AtlasCatalogue {
  version: string;
  items: readonly SkyItemBase[];
  shelves: readonly AtlasShelfBase[];
  holds: SkyAtlasData["holds"];
}

/** One learner's Atlas, as the difference from the catalogue. */
export interface AtlasPayload extends ItemDiff {
  version: string;
  /** How the shelves are going, in the catalogue's shelf order. */
  counts: readonly CoverageCounts[];
  /** Shelves the catalogue does not have, or has differently. Usually none,
   * the same escape hatch `extras` is for the items. */
  shelves?: readonly AtlasShelf[];
}

/** The catalogue and one learner's difference, back into the Atlas the Sky
 * takes. Pure, and the browser's half of the split. */
export function joinAtlas(catalogue: AtlasCatalogue, payload: AtlasPayload): SkyAtlasData {
  if (payload.shelves) {
    return { items: joinItems(catalogue.items, payload), shelves: payload.shelves, holds: catalogue.holds };
  }
  return {
    items: joinItems(catalogue.items, payload),
    shelves: catalogue.shelves.map((shelf, i) => ({ ...shelf, counts: payload.counts[i] ?? {} })),
    holds: catalogue.holds,
  };
}
