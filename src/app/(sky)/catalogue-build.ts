// Building the catalogues: every star and every tile this build could show,
// without a learner (SAK-381), worked out by running the real pipelines
// against an empty history so nothing can be shaped one way here and another
// on a learner's own pages. scripts/build-catalogues.mjs runs this once and
// writes the results under src/data/generated; catalogue.ts and
// atlas-catalogue.ts read those. It used to run on every cold start, in the
// modules that read it (SAK-399).

import { emptyHistory } from "@/lib/history-ops";
import type { AtlasShelf } from "@/sky/components/sky-atlas";

import { atlasFromHistory } from "./atlas";
import type { AtlasCatalogue, AtlasShelfBase } from "./atlas-payload";
import { versionOf } from "./catalogue-version";
import { withoutStanding } from "./item-split";
import { skyFromHistory, skyItems } from "./learner";
import { beyondWords } from "./observatory";
import type { SkyBase, SkyCatalogue } from "./sky-payload";

/** The clock the catalogues are built at. Nothing in an empty history ages,
 * so this only has to be the same number every time: a catalogue that
 * changed with the hour would be a new download every hour. */
export const NO_CLOCK = 0;

export function buildSkyCatalogue(): SkyCatalogue {
  const empty = skyFromHistory(emptyHistory(), NO_CLOCK, undefined, { everything: true, beyond: beyondWords });
  const items = empty.items.map(withoutStanding);
  const firmament = empty.firmament ?? [];
  return { version: versionOf(JSON.stringify({ items, firmament })), items, firmament };
}

/** What the sky holds before a learner has done anything (`SkyBase`). What
 * `beyondWords` adds depends on the learner. */
export function buildSkyBase(): SkyBase {
  const empty = skyItems(emptyHistory(), NO_CLOCK, { everything: true });
  return { baseIds: [...empty.items.keys()], fiveFirmament: empty.firmament };
}

export function buildAtlasCatalogue(): AtlasCatalogue {
  const empty = atlasFromHistory(emptyHistory(), NO_CLOCK);
  const items = empty.items.map(withoutStanding);
  const shelves = empty.shelves.map(withoutCounts);
  return { version: versionOf(JSON.stringify({ items, shelves })), items, shelves, holds: empty.holds };
}

/** A shelf without its counts, which are the learner's. */
export function withoutCounts(shelf: AtlasShelf): AtlasShelfBase {
  const { counts: _counts, ...rest } = shelf;
  return rest;
}
