// A practice run. Route: /dev/sky/practice/run?recipe=… (`&cards=` a retry
// of named cards, `?sample` the pretend learner). The items left out by
// hand ride in the recipe. The deck is built here; the answers stay in the
// browser as misses and never reach the schedule (SAK-318).

import { EMPTY_RECIPE, type Recipe } from "@/sky/lib/practice";

import { learnerHistory } from "../../atlas";
import { practiceCards } from "../../practice";
import { PracticeRunClient } from "../../practice-client";
import { cardsFor } from "../../quiz";
import { sampleHistory } from "../../sample-learner";
import { SkyPage } from "../../sky-page";

export const dynamic = "force-dynamic";

export default async function SkyPracticeRunPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  const history = sample ? sampleHistory() : await learnerHistory();
  let recipe: Recipe = EMPTY_RECIPE;
  try { recipe = { ...EMPTY_RECIPE, ...(JSON.parse(String(params.recipe ?? "{}")) as Partial<Recipe>) }; } catch { /* a bad recipe runs as everything */ }
  const named = String(params.cards ?? "").split(",").filter(Boolean);
  // the client's own misses are not known here, so the draw's shakiest-first
  // order leans on the schedule's misses alone
  const cards = named.length ? cardsFor(history, named) : practiceCards(history, recipe, {});
  return (
    <SkyPage note={sample ? "A pretend learner. Nothing is recorded, here or ever: practice never touches the schedule." : "Practice is never recorded against your review schedule."}>
      <PracticeRunClient cards={cards} sample={sample} recipe={recipe} />
    </SkyPage>
  );
}
