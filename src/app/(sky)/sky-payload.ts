// The sky, split into the part that is the same for everyone and the part
// that is not (SAK-381).
//
// The home used to send every star it could draw, with its standing, on every
// request: 2.15 MB for the sample learner and the same 2.15 MB for someone
// who had never opened the app, because their sky is empty and they still got
// the whole curriculum. Fifteen thousand items, and the only thing that
// differed between two learners was one word per item.
//
// So the items go out once, as a CATALOGUE: every star the sky could hold,
// without its standing, cached by the browser and the CDN under a version
// that changes when its contents do. What a learner gets is the difference:
// the standings that are not "not-seen", the constellations they have, the
// mix-ups, and a couple of small lists where their sky and the catalogue
// disagree. `joinSky` puts the two back together in the browser and hands the
// Sky exactly the SkyHomeData it always took, so nothing in src/sky knows any
// of this happened.
//
// The items themselves are split by item-split.ts, which the Atlas uses too;
// what is here is the rest of a sky, which is the home's alone.

import type { MixUp } from "@/sky/components/mix-ups-panel";
import type { DiscoveryRow } from "@/sky/components/discovery-panel";
import type { SkyHomeData } from "@/sky/components/sky-home";
import type { CoverageCounts } from "@/sky/lib/coverage";
import { joinItems, type ItemDiff, type SkyItemBase } from "./item-split";

/** Every star the sky could hold, for this build. Cached hard, so it carries
 * the version its contents hash to. */
export interface SkyCatalogue {
  version: string;
  items: readonly SkyItemBase[];
  /** The whole firmament, before a learner's own is taken into account. */
  firmament: readonly string[];
}

/** One learner's sky, as the difference from the catalogue. */
export interface SkyPayload extends ItemDiff {
  /** The catalogue this was split against. */
  version: string;
  roots: readonly string[];
  mixUps: readonly MixUp[];
  discovery: readonly DiscoveryRow[];
  standingCounts?: CoverageCounts;
  /** Firmament the catalogue is missing, and firmament it should not have.
   * A root is never firmament, so `joinSky` takes the roots out itself and
   * `firmamentDrop` carries only what the roots do not already account for. */
  firmamentAdd: readonly string[];
  firmamentDrop: readonly string[];
}

/** The catalogue and one learner's difference, back into the sky the Sky
 * takes. Pure, and the browser's half of the split. */
export function joinSky(catalogue: SkyCatalogue, payload: SkyPayload): SkyHomeData {
  const drop = new Set([...payload.firmamentDrop, ...payload.roots]);
  return {
    items: joinItems(catalogue.items, payload),
    roots: payload.roots,
    mixUps: payload.mixUps,
    discovery: payload.discovery,
    ...(payload.standingCounts ? { standingCounts: payload.standingCounts } : {}),
    firmament: [...catalogue.firmament.filter((id) => !drop.has(id)), ...payload.firmamentAdd],
  };
}

/** What the sky holds before a learner has done anything, for the server's
 * own use (built with the catalogue, catalogue-build.ts): the ids
 * `skyItems` puts in for everyone, and the firmament of the five kinds. */
export interface SkyBase {
  readonly baseIds: readonly string[];
  readonly fiveFirmament: readonly string[];
}
