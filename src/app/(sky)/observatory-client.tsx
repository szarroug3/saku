"use client";

// The Observatory's client side: the route's data or the browser's, and
// "I know these" through the app's own claim.

import { useRouter } from "next/navigation";

import { SkyObservatory, type SkyObservatoryData } from "@/sky/components/sky-observatory";

import { loadObservatory } from "./actions";
import { skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { claimIds } from "./writes";

export function ObservatoryClient({ sample, signedIn, initial, picks }: { sample: boolean; signedIn: boolean; initial: SkyObservatoryData | null; picks: readonly string[] }) {
  const router = useRouter();
  const { data, loading } = useSkyData({ sample, signedIn, load: loadObservatory, initial, eyebrow: "Observatory", title: "What would you like to learn next?" });
  if (!data) return loading;
  const claim = async (ids: readonly string[]) => { await claimIds(ids); router.refresh(); };
  return <SkyObservatory data={data} lessonHref={(picked) => skyHref("/lesson", { sample, picks: picked })} initialPicks={picks} onClaim={sample ? undefined : claim} />;
}
