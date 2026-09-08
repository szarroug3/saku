"use client";

// The Observatory's client side: the route's data or the browser's, and
// "I know these" through the app's own claim.

import { useRouter } from "next/navigation";

import { SkyObservatory, type SkyObservatoryData } from "@/sky/components/sky-observatory";
import type { SavedRun } from "@/sky/lib/quiz-run";

import { loadObservatory } from "./actions";
import { runHref, skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { useSavedRun } from "./quiz-run-store";
import { claimIds } from "./writes";

export function ObservatoryClient({ sample, signedIn, initial, picks, accountRun = null }: { sample: boolean; signedIn: boolean; initial: SkyObservatoryData | null; picks: readonly string[]; accountRun?: SavedRun | null }) {
  const router = useRouter();
  const { data, loading } = useSkyData({ sample, signedIn, load: loadObservatory, initial, eyebrow: "Observatory", title: "What would you like to learn next?" });
  // a quiz left part way through, offered back (SAK-404); this page is the
  // other place a learner lands, so it is the other place the line belongs
  const local = useSavedRun();
  const run = sample ? null : (local ?? accountRun);
  if (!data) return loading;
  const claim = async (ids: readonly string[]) => { await claimIds(ids); router.refresh(); };
  return <SkyObservatory data={data} lessonHref={(picked) => skyHref("/lesson", { sample, picks: picked })} initialPicks={picks} resume={run ? { run, href: runHref(run.from) } : undefined} onClaim={sample ? undefined : claim} />;
}
