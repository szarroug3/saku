"use client";

// The home sky's client side: the route's data when it had a history to
// read, else the browser's; clearing a mix-up through the app's own call.

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { SkyHome, type SkyHomeData } from "@/sky/components/sky-home";

import { loadSky } from "./actions";
import { SkyLoading, useLoaded, useWho } from "./local";
import { clearMixUpKey } from "./writes";

export function PlanetariumClient({ sample, signedIn, initial, graduateRuns }: { sample: boolean; signedIn: boolean; initial: SkyHomeData | null; graduateRuns?: number }) {
  const router = useRouter();
  const who = useWho(sample, signedIn, true);
  const load = useCallback((w: Parameters<typeof loadSky>[0]) => loadSky(w, graduateRuns), [graduateRuns]);
  const data = useLoaded(who, load, initial);
  if (!data) return <SkyLoading />;
  const clear = async (key: string) => { await clearMixUpKey(key); router.refresh(); };
  return <SkyHome data={data} observatoryHref={sample ? "/observatory?sample" : "/observatory"} onClearMixUp={sample ? undefined : clear} height="100%" />;
}
