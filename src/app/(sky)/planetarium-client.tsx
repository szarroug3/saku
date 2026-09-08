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

import { loadSky } from "./actions";
import { skyHref } from "./hrefs";
import { SkyLoading, useLoaded, useWho } from "./local";
import { joinSky, type SkyCatalogue, type SkyPayload } from "./sky-payload";
import { useCatalogue } from "./use-catalogue";
import { clearMixUpKey } from "./writes";

export function PlanetariumClient({ sample, signedIn, initial, graduateRuns }: { sample: boolean; signedIn: boolean; initial: SkyPayload | null; graduateRuns?: number }) {
  const router = useRouter();
  const who = useWho(sample, signedIn, true);
  const load = useCallback((w: Parameters<typeof loadSky>[0]) => loadSky(w, graduateRuns), [graduateRuns]);
  const payload = useLoaded(who, load, initial);
  const stars = useCatalogue<SkyCatalogue>("/api/sky-catalogue", payload?.version);
  if (!payload || !stars) return <SkyLoading eyebrow="Planetarium" title={"What have you discovered?"} />;
  const clear = async (key: string) => { await clearMixUpKey(key); router.refresh(); };
  return <SkyHome data={joinSky(stars, payload)} observatoryHref={skyHref("/observatory", { sample })} onClearMixUp={sample ? undefined : clear} height="100%" />;
}
