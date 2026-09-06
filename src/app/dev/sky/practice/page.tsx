// Practice, on the learner's real standings. Route: /dev/sky/practice
// (`?sample` shows a pretend learner; `?save=` brings a recipe back from a
// run to be named). Signed out, the browser's own standings.

import Link from "next/link";

import { currentUserId } from "@/lib/auth";
import { EMPTY_RECIPE, type Recipe } from "@/sky/lib/practice";

import { practiceLookup } from "../actions";
import { practiceCollections } from "../practice";
import { PracticeClient } from "../practice-client";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

function parseRecipe(raw: unknown): Recipe | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try { return { ...EMPTY_RECIPE, ...(JSON.parse(raw) as Partial<Recipe>) }; } catch { return undefined; }
}

export default async function SkyPracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const userId = sample ? null : await currentUserId();
  const toSave = parseRecipe(params.save);
  const initialPreview = sample ? await practiceLookup({ sample: true }, EMPTY_RECIPE, {}) : userId ? await practiceLookup({}, EMPTY_RECIPE, {}) : null;
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : userId ? "Your own standings. " : "Your standings, kept in this browser. "}
          <Link href={sample ? "/dev/sky/practice" : "/dev/sky/practice?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <PracticeClient collections={practiceCollections()} sample={sample} signedIn={userId !== null} initialPreview={initialPreview} toSave={toSave} />
    </SkyPage>
  );
}
