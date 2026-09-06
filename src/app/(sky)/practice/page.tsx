// Practice, on the learner's real standings. Route: /practice
// (`?sample` shows a pretend learner). Signed out, the browser's own
// standings. A run's results name and keep their own recipe now, so nothing
// arrives here through the query any more (SAK-395).

import { currentUserId } from "@/lib/auth";
import { EMPTY_RECIPE } from "@/sky/lib/practice";

import { practiceLookup } from "../actions";
import { practiceCollections } from "../practice";
import { PracticeClient } from "../practice-client";

export const metadata = { title: "Practice" };

export const dynamic = "force-dynamic";

export default async function SkyPracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const userId = sample ? null : await currentUserId();
  const initialPreview = sample ? await practiceLookup({ sample: true }, EMPTY_RECIPE, {}) : userId ? await practiceLookup({}, EMPTY_RECIPE, {}) : null;
  return (
    <>
      <PracticeClient collections={practiceCollections()} sample={sample} signedIn={userId !== null} initialPreview={initialPreview} />
    </>
  );
}
