// The sky's catalogue: every star this build could draw, without a learner
// (SAK-381). The server half of the split described in sky-payload.ts.
//
// Built by running the real pipeline against an empty history, not by a
// second implementation of it, so a star can never be shaped one way here and
// another way on a learner's own sky. It is the same function the home calls,
// given nobody.

import { activeWeaknessPairs } from "@/lib/confusions";
import { entryOf } from "@/lib/facts";
import { emptyHistory } from "@/lib/history-ops";
import { libEntry } from "@/lib/library/entries";
import type { StatsData } from "@/lib/library/server-lookups";
import type { MixUp } from "@/sky/components/mix-ups-panel";
import type { SkyHomeData } from "@/sky/components/sky-home";
import { buildGraph } from "@/sky/lib/graph";
import { skyRoots } from "@/sky/lib/sky-scene";
import type { Standing } from "@/sky/lib/standing";
import type { EntryId, HistoryFile } from "@/types";
import { versionOf } from "./catalogue-version";
import { splitItems, withoutStanding } from "./item-split";
import { discoveryRows, skyFromHistory, skyItems, standingFor, standingTallyOf, type SkyOptions } from "./learner";
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

// ---------- the payload worked out directly ----------
//
// `splitSky(skyFromHistory(h))` builds every one of the 15,380 items, a
// prerequisite graph over them and every root, and then keeps the standings.
// On the deployed function that build measured 876 ms of a home request,
// seven times what the database costs now (SAK-382). Almost all of it is the
// same work for every learner, done again per request.
//
// So the parts that are the same for everyone are done once, as the module
// loads (and Fluid Compute holds a process ready before a request arrives, so
// this costs the request nothing): the graph, which reads only ids and
// components; the ids the sky holds before anyone has done anything; and the
// firmament of the five kinds that are always up there. What a learner
// changes is worked out per request: which stars they have met, how each is
// going, which constellations are theirs.
//
// The rules below are `skyFromHistory`'s, restated, and that is the risk.
// `sky-payload.test.ts` runs both over several learners and asserts the
// payloads agree exactly, `extras` included, since the direct route never
// builds an item to compare against the catalogue and so cannot discover for
// itself that it needed none.

/** Every star, as the graph reads it. Standing is not read, and is filled
 * in only because the graph's type wants a whole item. */
const GRAPH = buildGraph(built.items.map((i) => ({ ...i, standing: "not-seen" as const })));

/** What the sky holds before a learner has done anything: the ids
 * `skyItems` puts in for everyone, and the firmament of the five kinds.
 * What `beyondWords` adds on top depends on the learner and is not here. */
const EMPTY = skyItems(emptyHistory(), NO_CLOCK, { everything: true });
const BASE_IDS: ReadonlySet<string> = new Set(EMPTY.items.keys());
const FIVE_FIRMAMENT: readonly string[] = EMPTY.firmament;

/** One learner's sky payload, worked out directly. */
export function skyPayloadFor(history: HistoryFile, now = Date.now(), stats?: StatsData, options: SkyOptions = {}, catalogue = skyCatalogue()): SkyPayload {
  const standings: Record<string, Standing> = {};
  const met = new Set<string>();

  // the five kinds: how each is going, and whether it has been met
  for (const item of catalogue.items) {
    if (!BASE_IDS.has(item.id)) continue;
    const entry = libEntry(item.id as EntryId);
    if (!entry) continue;
    const { standing, met: isMet } = standingFor(entry, history, now);
    if (standing !== "not-seen") standings[item.id] = standing;
    if (isMet) met.add(item.id);
  }

  // The rest: what the Observatory offers, and what of it has been met.
  // `skyFromHistory` lets one of these replace the plainer version of itself
  // only when it is met or was not there at all, so its standing is taken on
  // the same terms.
  const beyond = options.beyond?.(history, now);
  const beyondMet = new Set(beyond?.met ?? []);
  const have = new Set<string>(catalogue.items.map((i) => i.id));
  for (const it of beyond?.items ?? []) {
    have.add(it.id);
    if (beyondMet.has(it.id) || !BASE_IDS.has(it.id)) {
      if (it.standing !== "not-seen") standings[it.id] = it.standing;
      else delete standings[it.id];
    }
  }
  for (const id of beyondMet) met.add(id);

  const roots = skyRoots(GRAPH, met);
  const rootSet = new Set(roots);

  const needed = options.graduateRuns ?? 10;
  const mixUps: MixUp[] = activeWeaknessPairs(history, needed, entryOf)
    .filter((p) => have.has(p.a) && have.has(p.b))
    .map((p) => ({ key: p.key, a: p.a, b: p.b, times: p.runsMixedUp, cleanRuns: p.cleanStreak, needed }));

  const mine = new Set([...FIVE_FIRMAMENT, ...(beyond?.firmament ?? [])].filter((id) => !rootSet.has(id)));
  const theirs = new Set(catalogue.firmament);
  const discovery = stats ? discoveryRows(history, stats, now) : [];
  return {
    version: catalogue.version,
    standings,
    extras: [],
    roots,
    mixUps,
    discovery,
    ...(stats ? { standingCounts: standingTallyOf(discovery) } : {}),
    firmamentAdd: [...mine].filter((id) => !theirs.has(id)),
    firmamentDrop: [...theirs].filter((id) => !mine.has(id) && !rootSet.has(id)),
  };
}
