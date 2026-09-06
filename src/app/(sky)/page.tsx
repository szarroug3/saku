// The Sky's Planetarium, the home: the learner's sky on their real progress,
// every kana, piece and kanji up there and lit as discovered, and the
// counters, grammar, sentence rules, verb pairs and keigo met so far as
// their own bodies. Route: /. Per request, never
// prerendered. `?sample` shows a pretend learner. Signed out, the browser's
// own sky (see local.tsx).

import { preload } from "react-dom";

import { currentUserId } from "@/lib/auth";

import { loadSky } from "./actions";
import { ServerTimingMeta } from "./server-timing-meta";
import { skyCatalogue } from "./catalogue";
import { PlanetariumClient } from "./planetarium-client";

export const dynamic = "force-dynamic";

export default async function SkyPlanetariumPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const userId = sample ? null : await currentUserId();
  // The difference from the catalogue, not the sky itself: the stars come
  // from /api/sky-catalogue, cached (SAK-381). It reads the learner's bar for
  // clearing a mix-up itself, alongside the history rather than before it
  // (SAK-382), so the page does not wait for one database answer to ask for
  // the next.
  const initial = sample ? await loadSky({ sample: true }) : userId ? await loadSky({}) : null;
  // Start the stars downloading with the HTML instead of after hydration.
  // The version is the same for every learner, so the page knows it without
  // knowing whose sky this is (SAK-381).
  preload(`/api/sky-catalogue/${skyCatalogue().version}`, { as: "fetch", crossOrigin: "anonymous" });
  return (
    <>
      <ServerTimingMeta />
      <PlanetariumClient sample={sample} signedIn={userId !== null} initial={initial} />
    </>
  );
}
