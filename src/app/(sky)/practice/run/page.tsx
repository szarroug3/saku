// A practice run. Route: /practice/run?recipe=… (`&cards=` a retry
// of named cards, `?sample` the pretend learner). The items left out by
// hand ride in the recipe. The deck is built here; the answers are recorded
// by the client, through the same recorder a quiz uses (SAK-441).

import { EMPTY_RECIPE, type Recipe } from "@/sky/lib/practice";

import { loadPlace, loadPracticeCards, loadQuiz } from "../../actions";
import { idsFrom } from "../../hrefs";
import { initialFor, whoFor } from "../../page-data";
import { ServerTimingMeta } from "../../server-timing-meta";
import { PracticeRunClient } from "../../practice-client";

export const metadata = { title: "Practice" };

export const dynamic = "force-dynamic";

export default async function SkyPracticeRunPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { sample, signedIn, who } = await whoFor(params);
  let recipe: Recipe = EMPTY_RECIPE;
  try { recipe = { ...EMPTY_RECIPE, ...(JSON.parse(String(params.recipe ?? "{}")) as Partial<Recipe>) }; } catch { /* a bad recipe runs as everything */ }
  const named = idsFrom(params.cards);
  // the deck and what was left part way through at the same time (SAK-404);
  // a visitor's place is in their browser, so there is nothing to read here
  const [initial, accountPlace] = await Promise.all([
    initialFor(who, (w) => (named.length ? loadQuiz(w, { cards: named }) : loadPracticeCards(w, recipe))),
    sample || !signedIn ? undefined : loadPlace(),
  ]);
  return (
    <>
      <PracticeRunClient initial={initial} named={named} sample={sample} signedIn={signedIn} recipe={recipe} accountPlace={accountPlace} />
      <ServerTimingMeta />
    </>
  );
}
