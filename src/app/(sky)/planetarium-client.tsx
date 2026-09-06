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
import { useCallback, useEffect, useState } from "react";

import { SkyHome } from "@/sky/components/sky-home";

import { loadSky } from "./actions";
import { SkyLoading, useLoaded, useWho } from "./local";
import { joinSky, type SkyCatalogue, type SkyPayload } from "./sky-payload";
import { clearMixUpKey } from "./writes";

/** One fetch per browser tab, shared by everyone who asks. Kept out of React
 * so a second visit to the home in the same tab does not fetch again, and two
 * mounts in the same tick share the one request. */
const held = new Map<string, Promise<SkyCatalogue>>();

function catalogue(version: string): Promise<SkyCatalogue> {
  const have = held.get(version);
  if (have) return have;
  const wanted = fetch(`/api/sky-catalogue/${encodeURIComponent(version)}`)
    .then((r) => {
      if (!r.ok) throw new Error(`the sky's catalogue answered ${r.status}`);
      return r.json() as Promise<SkyCatalogue>;
    })
    .catch((err) => {
      // a failed fetch must not be remembered as the answer
      held.delete(version);
      throw err;
    });
  held.set(version, wanted);
  return wanted;
}

/** The catalogue the payload names, once it is here. */
function useCatalogue(version: string | undefined): SkyCatalogue | null {
  const [got, setGot] = useState<SkyCatalogue | null>(null);
  useEffect(() => {
    if (!version) return;
    let live = true;
    catalogue(version).then((c) => { if (live) setGot(c); });
    return () => { live = false; };
  }, [version]);
  return got;
}

export function PlanetariumClient({ sample, signedIn, initial, graduateRuns }: { sample: boolean; signedIn: boolean; initial: SkyPayload | null; graduateRuns?: number }) {
  const router = useRouter();
  const who = useWho(sample, signedIn, true);
  const load = useCallback((w: Parameters<typeof loadSky>[0]) => loadSky(w, graduateRuns), [graduateRuns]);
  const payload = useLoaded(who, load, initial);
  const stars = useCatalogue(payload?.version);
  if (!payload || !stars) return <SkyLoading />;
  const clear = async (key: string) => { await clearMixUpKey(key); router.refresh(); };
  return <SkyHome data={joinSky(stars, payload)} observatoryHref={sample ? "/observatory?sample" : "/observatory"} onClearMixUp={sample ? undefined : clear} height="100%" />;
}
