// The Sky's Atlas, on the learner's real progress. Route: /atlas
// (`?sample` a pretend learner, `?entry=` opens one). Signed out, the
// browser's own progress, handed up with each lookup.

import { preload } from "react-dom";

import { currentUserId } from "@/lib/auth";

import { loadAtlas } from "../actions";
import { atlasCatalogue } from "../atlas-catalogue";
import { AtlasClient } from "../atlas-client";

export const metadata = { title: "Atlas" };

export const dynamic = "force-dynamic";

export default async function SkyAtlasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const entry = typeof params.entry === "string" && params.entry ? params.entry : undefined;
  const userId = sample ? null : await currentUserId();
  const initial = sample ? await loadAtlas({ sample: true }) : userId ? await loadAtlas({}) : null;
  // start the tiles downloading with the HTML instead of after hydration
  preload(`/api/atlas-catalogue/${atlasCatalogue().version}`, { as: "fetch", crossOrigin: "anonymous" });
  return (
    <>
      <AtlasClient sample={sample} signedIn={userId !== null} initial={initial} entry={entry} />
    </>
  );
}
