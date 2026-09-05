// The Sky's Observatory, on the signed-in learner's real progress. Route:
// /dev/sky/observatory. One call: the route loads what is on offer through
// the adapter and hands it to SkyObservatory. `?sample` shows a pretend
// learner instead.

import Link from "next/link";

import { SkyObservatory } from "@/sky/components/sky-observatory";

import { claimTrack } from "../actions";
import { SkyPage } from "../sky-page";
import { learnerObservatory, observatoryFromHistory } from "../observatory";
import { sampleHistory } from "../sample-learner";

export const dynamic = "force-dynamic";

export default async function SkyObservatoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const data = sample ? observatoryFromHistory(sampleHistory()) : await learnerObservatory();
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : "Your own progress. "}
          <Link href={sample ? "/dev/sky/observatory" : "/dev/sky/observatory?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <SkyObservatory data={data} lessonPath="/dev/sky/lesson" height="100%" onClaim={sample ? undefined : claimTrack} />
    </SkyPage>
  );
}
