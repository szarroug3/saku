// The Sky's Planetarium, the home: the learner's sky on their real progress,
// every kana, piece and kanji up there and lit as discovered, and the
// counters, grammar, sentence rules, verb pairs and keigo met so far as
// their own bodies. Route: /. Per request, never
// prerendered. `?sample` shows a pretend learner. Signed out, the browser's
// own sky (see local.tsx).

import Link from "next/link";

import { currentUserId } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";

import { loadSky } from "./actions";
import { PlanetariumClient } from "./planetarium-client";
import { SkyPage } from "./sky-page";

export const dynamic = "force-dynamic";

export default async function SkyPlanetariumPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const userId = sample ? null : await currentUserId();
  // the learner's own bar for clearing a mix-up, from Settings
  const graduateRuns = userId ? ((await loadSettings(userId)).cfg?.graduateRuns ?? undefined) : undefined;
  const initial = sample ? await loadSky({ sample: true }) : userId ? await loadSky({}, graduateRuns) : null;
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : userId ? "Your own progress. " : "Your progress, kept in this browser. "}
          <Link href={sample ? "/" : "/?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <PlanetariumClient sample={sample} signedIn={userId !== null} initial={initial} graduateRuns={graduateRuns} />
    </SkyPage>
  );
}
