"use client";

// The Observatory's client side: the route's data or the browser's, and
// "I know these" through the app's own claim.

import { useRouter } from "next/navigation";

import { SkyObservatory, type SkyObservatoryData } from "@/sky/components/sky-observatory";
import { hasPlace, newestPlace, NO_PLACE, type SavedPlace } from "@/sky/lib/place";

import { loadObservatory } from "./actions";
import { placeHref, skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { useSavedPlace } from "./quiz-run-store";
import { claimIds } from "./writes";

export function ObservatoryClient({ sample, signedIn, initial, picks, accountPlace = NO_PLACE }: { sample: boolean; signedIn: boolean; initial: SkyObservatoryData | null; picks: readonly string[]; accountPlace?: SavedPlace }) {
  const router = useRouter();
  const { data, loading } = useSkyData({ sample, signedIn, load: loadObservatory, initial, eyebrow: "Observatory", title: "What would you like to learn next?" });
  // what was left part way through, offered back (SAK-404, SAK-444); this
  // page is the other place a learner lands, so it is the other place the
  // button belongs. It never stops "Start lesson" doing exactly what it says.
  const local = useSavedPlace();
  const entry = sample ? null : newestPlace(hasPlace(local) ? local : accountPlace);
  if (!data) return loading;
  const claim = async (ids: readonly string[]) => { await claimIds(ids); router.refresh(); };
  return <SkyObservatory data={data} lessonHref={(picked) => skyHref("/lesson", { sample, picks: picked })} initialPicks={picks} resume={entry ? { entry, href: placeHref(entry, sample) } : undefined} onClaim={sample ? undefined : claim} />;
}
