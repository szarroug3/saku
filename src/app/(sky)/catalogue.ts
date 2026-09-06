// The sky's catalogue: every star this build could draw, without a learner
// (SAK-381). The server half of the split described in sky-payload.ts.
//
// Built by running the real pipeline against an empty history, not by a
// second implementation of it, so a star can never be shaped one way here and
// another way on a learner's own sky. It is the same function the home calls,
// given nobody.

import { emptyHistory } from "@/lib/history-ops";
import type { SkyHomeData } from "@/sky/components/sky-home";
import { versionOf } from "./catalogue-version";
import { splitItems, withoutStanding } from "./item-split";
import { skyFromHistory } from "./learner";
import { beyondWords } from "./observatory";
import type { SkyCatalogue, SkyPayload } from "./sky-payload";

/** The clock the catalogue is built at. Nothing in an empty history ages, so
 * this only has to be the same number every time: a catalogue that changed
 * with the hour would be a new download every hour. */
const NO_CLOCK = 0;

/** Every star, built as this module loads rather than on the first request
 * that wants it. See atlas-catalogue.ts for why: a process is held ready
 * before a request arrives, so work done here is work the request does not
 * wait for, and work left until first use is paid for by whoever knocks
 * first. */
const built: SkyCatalogue = buildSkyCatalogue();

export function skyCatalogue(): SkyCatalogue {
  return built;
}

function buildSkyCatalogue(): SkyCatalogue {
  const empty = skyFromHistory(emptyHistory(), NO_CLOCK, undefined, { everything: true, beyond: beyondWords });
  const items = empty.items.map(withoutStanding);
  const firmament = empty.firmament ?? [];
  return { version: versionOf(JSON.stringify({ items, firmament })), items, firmament };
}

/** One learner's sky as its difference from the catalogue. The inverse of
 * `joinSky`, and `sky-payload.test.ts` holds the two together. */
export function splitSky(data: SkyHomeData, catalogue = skyCatalogue()): SkyPayload {
  const mine = new Set(data.firmament ?? []);
  const theirs = new Set(catalogue.firmament);
  // the roots go without saying: the firmament never holds one, so `joinSky`
  // takes them out and they do not need listing twice
  const roots = new Set(data.roots);
  return {
    version: catalogue.version,
    ...splitItems(data.items, catalogue.items),
    roots: data.roots,
    mixUps: data.mixUps,
    discovery: data.discovery,
    ...(data.standingCounts ? { standingCounts: data.standingCounts } : {}),
    firmamentAdd: [...mine].filter((id) => !theirs.has(id)),
    firmamentDrop: [...theirs].filter((id) => !mine.has(id) && !roots.has(id)),
  };
}
