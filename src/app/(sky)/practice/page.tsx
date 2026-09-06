// Practice, on the learner's real standings. Route: /practice
// (`?sample` shows a pretend learner; `?save=` brings a recipe back from a
// run to be named). Signed out, the browser's own standings.

import { currentUserId } from "@/lib/auth";
import { EMPTY_RECIPE, type Recipe } from "@/sky/lib/practice";

import { practiceLookup } from "../actions";
import { practiceCollections } from "../practice";
import { PracticeClient } from "../practice-client";

export const metadata = { title: "Practice" };

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
    <>
      <PracticeClient collections={practiceCollections()} sample={sample} signedIn={userId !== null} initialPreview={initialPreview} toSave={toSave} />
    </>
  );
}
