// The Sky's Atlas, on the signed-in learner's real progress. Route:
// /dev/sky/atlas. One call: the route loads the shelves through the adapter
// and hands SkyAtlas the two lookups (search, entry) as server actions bound
// to whose history they read. `?sample` shows a pretend learner instead;
// `?entry=` opens one.

import Link from "next/link";

import { HearButton } from "@/components/ui/hear-button";
import { SkyAtlas } from "@/sky/components/sky-atlas";

import { atlasEntry, atlasSearch } from "../actions";
import { atlasFromHistory, learnerAtlas } from "../atlas";
import { PitchMark } from "../pitch-reading";
import { sampleHistory } from "../sample-learner";
import { SkyPage } from "../sky-page";
import { WrittenBlock } from "../written-block";

export const dynamic = "force-dynamic";

export default async function SkyAtlasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const entry = typeof params.entry === "string" && params.entry ? params.entry : undefined;
  const data = sample ? atlasFromHistory(sampleHistory()) : await learnerAtlas();
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : "Your own progress. "}
          <Link href={sample ? "/dev/sky/atlas" : "/dev/sky/atlas?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <SkyAtlas
        data={data}
        lookup={{ search: atlasSearch.bind(null, sample), entry: atlasEntry.bind(null, sample) }}
        observatoryHref={sample ? "/dev/sky/observatory?sample" : "/dev/sky/observatory"}
        quizHref="/session"
        written={WrittenBlock}
        hear={HearButton}
        pitch={PitchMark}
        initialEntry={entry}
        height="100%"
      />
    </SkyPage>
  );
}
