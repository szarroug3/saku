"use client";

// The home sky's client side: the route's data when it had a history to
// read, else the browser's; clearing a mix-up through the app's own call.
//
// Two things arrive, not one (SAK-381). The learner's own sky is small and
// comes from the route or a server action, the way it always did. The stars
// themselves are the same for everybody, so they come from
// /api/sky-catalogue, once per browser, cached under a version that only
// changes when the stars do. `joinSky` puts them together and the Sky gets
// exactly the SkyHomeData it always got.

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { SkyHome } from "@/sky/components/sky-home";

import { hasPlace, newestPlace, NO_PLACE, type SavedPlace } from "@/sky/lib/place";

import { loadSky } from "./actions";
import { placeHref, skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { useSavedPlace } from "./quiz-run-store";
import { joinSky, type SkyCatalogue, type SkyPayload } from "./sky-payload";
import { useCatalogue } from "./use-catalogue";
import { clearMixUpKey } from "./writes";

export function PlanetariumClient({ sample, signedIn, initial, graduateRuns, accountPlace = NO_PLACE }: { sample: boolean; signedIn: boolean; initial: SkyPayload | null; graduateRuns?: number; accountPlace?: SavedPlace }) {
  const router = useRouter();
  const load = useCallback((w: Parameters<typeof loadSky>[0]) => loadSky(w, graduateRuns), [graduateRuns]);
  const { data: payload, loading } = useSkyData({ sample, signedIn, full: true, load, initial, eyebrow: "Planetarium", title: "What have you discovered?" });
  const stars = useCatalogue<SkyCatalogue>("/api/sky-catalogue", payload?.version);
  // What was left part way through, offered back (SAK-404, SAK-444). The
  // browser's copy is read live here, since this page never writes one; the
  // account's is what the route read, for a learner who left off on another
  // machine. The newest of the two things kept is what the button offers; the
  // other waits in Sessions. The pretend learner leaves nothing, so it is
  // offered nothing.
  const local = useSavedPlace();
  const entry = sample ? null : newestPlace(hasPlace(local) ? local : accountPlace);
  if (!payload || !stars) return loading;
  const clear = async (key: string) => { await clearMixUpKey(key); router.refresh(); };
  return <SkyHome data={joinSky(stars, payload)} observatoryHref={skyHref("/observatory", { sample })} resume={entry ? { entry, href: placeHref(entry, sample) } : undefined} onClearMixUp={sample ? undefined : clear} />;
}
