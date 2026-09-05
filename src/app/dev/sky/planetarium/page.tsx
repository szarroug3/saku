// The Sky's Planetarium, on the signed-in learner's real progress. Route:
// /dev/sky/planetarium. One call: the route loads what is on offer through
// the adapter and hands it to SkyPlanetarium. `?sample` shows a pretend
// learner instead.

import Link from "next/link";

import { SkyPlanetarium } from "@/sky/components/sky-planetarium";

import { SkyPage } from "../sky-page";
import { learnerPlanetarium, planetariumFromHistory } from "../planetarium";
import { sampleHistory } from "../sample-learner";

export const dynamic = "force-dynamic";

export default async function SkyPlanetariumPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const data = sample ? planetariumFromHistory(sampleHistory()) : await learnerPlanetarium();
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : "Your own progress. "}
          <Link href={sample ? "/dev/sky/planetarium" : "/dev/sky/planetarium?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <SkyPlanetarium data={data} lessonPath="/dev/sky/lesson" height="100%" />
    </SkyPage>
  );
}
