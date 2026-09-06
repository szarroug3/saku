// The Sky's Atlas, on the learner's real progress. Route: /atlas
// (`?sample` a pretend learner, `?entry=` opens one). Signed out, the
// browser's own progress, handed up with each lookup.

import Link from "next/link";

import { currentUserId } from "@/lib/auth";

import { loadAtlas } from "../actions";
import { AtlasClient } from "../atlas-client";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

export default async function SkyAtlasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const entry = typeof params.entry === "string" && params.entry ? params.entry : undefined;
  const userId = sample ? null : await currentUserId();
  const initial = sample ? await loadAtlas({ sample: true }) : userId ? await loadAtlas({}) : null;
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : userId ? "Your own progress. " : "Your progress, kept in this browser. "}
          <Link href={sample ? "/atlas" : "/atlas?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <AtlasClient sample={sample} signedIn={userId !== null} initial={initial} entry={entry} />
    </SkyPage>
  );
}
