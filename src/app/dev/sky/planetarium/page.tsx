// The Sky's Planetarium, the home: the signed-in learner's sky on their real
// progress, every kana, piece and kanji up there and lit as discovered.
// Route: /dev/sky/planetarium. Per request, never prerendered. `?sample`
// shows a pretend learner instead.

import Link from "next/link";

import { SkyHome } from "@/sky/components/sky-home";

import { getStatsRows } from "@/lib/library/server-lookups";

import { learnerSky, skyFromHistory } from "../learner";
import { sampleHistory } from "../sample-learner";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

export default async function SkyPlanetariumPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const options = { everything: true };
  const data = sample ? skyFromHistory(sampleHistory(), undefined, await getStatsRows(), options) : await learnerSky(undefined, options);
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : "Your own progress. "}
          <Link href={sample ? "/dev/sky/planetarium" : "/dev/sky/planetarium?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <SkyHome data={data} observatoryHref="/dev/sky/observatory" height="100%" />
    </SkyPage>
  );
}
