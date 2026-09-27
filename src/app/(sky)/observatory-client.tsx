"use client";

// The Observatory's client side: the route's data or the browser's, "I know
// these" through the app's own claim, and the newest thing left part way
// through offered back beside the heading, the way every page offers it
// (use-resume.ts).

import { SkyObservatory, type SkyObservatoryData } from "@/sky/components/sky-observatory";
import { NO_PLACE, type SavedPlace } from "@/sky/lib/place";

import { loadObservatory } from "./actions";
import { skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { useRefreshed } from "./use-refresh";
import { useResume } from "./use-resume";
import { claimIds } from "./writes";

export function ObservatoryClient({ sample, signedIn, initial, picks, accountPlace = NO_PLACE }: { sample: boolean; signedIn: boolean; initial: SkyObservatoryData | null; picks: readonly string[]; accountPlace?: SavedPlace }) {
  const { data, loading } = useSkyData({ sample, signedIn, load: loadObservatory, initial, eyebrow: "Observatory", title: "What would you like to learn next?" });
  // this page is the other place a learner lands, so it is the other place
  // the button belongs (SAK-404, SAK-444). It never stops "Start lesson"
  // doing exactly what it says.
  const resume = useResume(sample, signedIn, accountPlace);
  const claim = useRefreshed(claimIds);
  if (!data) return loading;
  return <SkyObservatory data={data} lessonHref={(picked) => skyHref("/lesson", { sample, picks: picked })} initialPicks={picks} resume={resume} onClaim={sample ? undefined : claim} />;
}
