// Practice, on the signed-in learner's real standings. Route:
// /dev/sky/practice (`?sample` shows a pretend learner; `?save=` brings a
// recipe back from a run to be named). One call: the route resolves the
// opening recipe and hands the client a bound lookup for the rest.

import Link from "next/link";

import { EMPTY_RECIPE, type Recipe } from "@/sky/lib/practice";

import { practiceLookup } from "../actions";
import { learnerHistory } from "../atlas";
import { practiceCollections, practicePreview } from "../practice";
import { PracticeClient } from "../practice-client";
import { sampleHistory } from "../sample-learner";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

function parseRecipe(raw: unknown): Recipe | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try { return { ...EMPTY_RECIPE, ...(JSON.parse(raw) as Partial<Recipe>) }; } catch { return undefined; }
}

export default async function SkyPracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const history = sample ? sampleHistory() : await learnerHistory();
  const toSave = parseRecipe(params.save);
  const initial = { recipe: EMPTY_RECIPE, preview: practicePreview(history, EMPTY_RECIPE) };
  return (
    <SkyPage
      note={
        <>
          {sample ? "A pretend learner. " : "Your own standings. "}
          <Link href={sample ? "/dev/sky/practice" : "/dev/sky/practice?sample"} className="underline">{sample ? "Show mine" : "Show a sample learner"}</Link>
        </>
      }
    >
      <PracticeClient collections={practiceCollections()} sample={sample} initial={initial} lookup={practiceLookup.bind(null, sample)} toSave={toSave} />
    </SkyPage>
  );
}
