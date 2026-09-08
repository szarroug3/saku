// The Sky's Atlas, on the learner's real progress. Route: /atlas
// (`?sample` a pretend learner, `?entry=` opens one). Signed out, the
// browser's own progress, handed up with each lookup.

import { preload } from "react-dom";

import { loadAtlas } from "../actions";
import { initialFor, whoFor } from "../page-data";
import { ServerTimingMeta } from "../server-timing-meta";
import { atlasCatalogue } from "../atlas-catalogue";
import { AtlasClient } from "../atlas-client";

export const metadata = { title: "Atlas" };

export const dynamic = "force-dynamic";

export default async function SkyAtlasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { sample, signedIn, who } = await whoFor(params);
  const entry = typeof params.entry === "string" && params.entry ? params.entry : undefined;
  const initial = await initialFor(who, loadAtlas);
  // start the tiles downloading with the HTML instead of after hydration
  preload(`/api/atlas-catalogue/${atlasCatalogue().version}`, { as: "fetch", crossOrigin: "anonymous" });
  return (
    <>
      <ServerTimingMeta />
      <AtlasClient sample={sample} signedIn={signedIn} initial={initial} entry={entry} />
    </>
  );
}
