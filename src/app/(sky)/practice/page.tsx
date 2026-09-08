// Practice, on the learner's real standings. Route: /practice
// (`?sample` shows a pretend learner). Signed out, the browser's own
// standings. A run's results name and keep their own recipe now, so nothing
// arrives here through the query any more (SAK-395).

import { EMPTY_RECIPE } from "@/sky/lib/practice";

import { practiceLookup } from "../actions";
import { initialFor, whoFor } from "../page-data";
import { ServerTimingMeta } from "../server-timing-meta";
import { practiceCollections } from "../practice";
import { PracticeClient } from "../practice-client";

export const metadata = { title: "Practice" };

export const dynamic = "force-dynamic";

export default async function SkyPracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { sample, signedIn, who } = await whoFor(params);
  const initialPreview = await initialFor(who, (w) => practiceLookup(w, EMPTY_RECIPE, {}));
  return (
    <>
      <PracticeClient collections={practiceCollections()} sample={sample} signedIn={signedIn} initialPreview={initialPreview} />
      <ServerTimingMeta />
    </>
  );
}
