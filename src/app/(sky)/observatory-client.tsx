"use client";

// The Observatory's client side: the route's data or the browser's, and
// "I know these" through the app's own claim.

import { useRouter } from "next/navigation";

import { SkyObservatory, type SkyObservatoryData } from "@/sky/components/sky-observatory";

import { loadObservatory } from "./actions";
import { SkyLoading, useLoaded, useWho } from "./local";
import { claimIds } from "./writes";

export function ObservatoryClient({ sample, signedIn, initial, picks }: { sample: boolean; signedIn: boolean; initial: SkyObservatoryData | null; picks: readonly string[] }) {
  const router = useRouter();
  const who = useWho(sample, signedIn);
  const data = useLoaded(who, loadObservatory, initial);
  if (!data) return <SkyLoading />;
  const claim = async (ids: readonly string[]) => { await claimIds(ids); router.refresh(); };
  return <SkyObservatory data={data} lessonPath={sample ? "/lesson?sample" : "/lesson"} initialPicks={picks} height="100%" onClaim={sample ? undefined : claim} />;
}
