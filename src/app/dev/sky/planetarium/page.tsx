// The Sky's Planetarium, the home: the signed-in learner's sky on their real
// progress, every kana, piece and kanji up there and lit as discovered, and
// the counters, grammar, sentence rules, verb pairs and keigo met so far as
// their own bodies.
// Route: /dev/sky/planetarium. Per request, never prerendered. `?sample`
// shows a pretend learner instead.

import Link from "next/link";

import { SkyHome } from "@/sky/components/sky-home";

import { currentUserId } from "@/lib/auth";
import { getStatsRows } from "@/lib/library/server-lookups";
import { loadSettings } from "@/lib/settings";

import { clearMixUp } from "../actions";
import { learnerSky, skyFromHistory } from "../learner";
import { metBeyondWords } from "../observatory";
import { sampleHistory } from "../sample-learner";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

export default async function SkyPlanetariumPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  // everything, and the planets, asteroids and binaries the Observatory knows how to build
  // the learner's own bar for clearing a mix-up, from Settings
  const userId = sample ? null : await currentUserId();
  const graduateRuns = userId ? ((await loadSettings(userId)).cfg?.graduateRuns ?? undefined) : undefined;
  const options = { everything: true, beyond: metBeyondWords, ...(graduateRuns ? { graduateRuns } : {}) };
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
      <SkyHome data={data} observatoryHref="/dev/sky/observatory" onClearMixUp={sample ? undefined : clearMixUp} height="100%" />
    </SkyPage>
  );
}
