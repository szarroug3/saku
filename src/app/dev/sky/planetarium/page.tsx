// The Sky's Planetarium, on the signed-in learner's real progress. Route:
// /dev/sky/planetarium. One call: the route loads what is on offer through
// the adapter and hands it to SkyPlanetarium. `?sample` shows a pretend
// learner instead.

import Link from "next/link";

import { SkyPlanetarium } from "@/sky/components/sky-planetarium";

import { learnerPlanetarium, planetariumFromHistory } from "../planetarium";
import { sampleHistory } from "../sample-learner";

export const dynamic = "force-dynamic";

export default async function SkyPlanetariumPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const data = sample ? planetariumFromHistory(sampleHistory()) : await learnerPlanetarium();
  return (
    <div className="sky-wash -mx-6 -my-8 min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="mx-auto max-w-[1180px]">
        <p className="mb-4 font-sky-ui text-[12px] text-sky-muted">
          {sample ? "A pretend learner. " : "Your own progress. "}
          <Link href={sample ? "/dev/sky/planetarium" : "/dev/sky/planetarium?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </p>
        <SkyPlanetarium data={data} lessonPath="/dev/sky/lesson" />
      </div>
    </div>
  );
}
