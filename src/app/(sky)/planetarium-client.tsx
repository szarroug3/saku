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

import { useCallback } from "react";

import { SkyHome } from "@/sky/components/sky-home";

import { NO_PLACE, type SavedPlace } from "@/sky/lib/place";

import { loadSky } from "./actions";
import { skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { joinSky, type SkyCatalogue, type SkyPayload } from "./sky-payload";
import { useCatalogue } from "./use-catalogue";
import { useRefreshed } from "./use-refresh";
import { useResume } from "./use-resume";
import { clearMixUpKey } from "./writes";

export function PlanetariumClient({ sample, signedIn, initial, graduateRuns, accountPlace = NO_PLACE }: { sample: boolean; signedIn: boolean; initial: SkyPayload | null; graduateRuns?: number; accountPlace?: SavedPlace }) {
  const load = useCallback((w: Parameters<typeof loadSky>[0]) => loadSky(w, graduateRuns), [graduateRuns]);
  const { data: payload, loading } = useSkyData({ sample, signedIn, full: true, load, initial, eyebrow: "Planetarium", title: "What have you discovered?" });
  const stars = useCatalogue<SkyCatalogue>("/api/sky-catalogue", payload?.version);
  // What was left part way through, offered back beside the heading with the
  // X that forgets it, the way every page offers it (SAK-404, SAK-444,
  // SAK-492; use-resume.ts). The other thing kept waits in Sessions.
  const resume = useResume(sample, signedIn, accountPlace);
  const clear = useRefreshed(clearMixUpKey);
  if (!payload || !stars) return loading;
  return <SkyHome data={joinSky(stars, payload)} observatoryHref={skyHref("/observatory", { sample })} resume={resume} onClearMixUp={sample ? undefined : clear} />;
}
