// A practice run. Route: /practice/run?recipe=… (`&cards=` a retry
// of named cards, `?sample` the pretend learner). The items left out by
// hand ride in the recipe. The deck is built here; the answers stay in the
// browser as misses and never reach the schedule (SAK-318).

import { currentUserId } from "@/lib/auth";
import { EMPTY_RECIPE, type Recipe } from "@/sky/lib/practice";

import { loadPracticeCards, loadQuiz, loadQuizRun } from "../../actions";
import { ServerTimingMeta } from "../../server-timing-meta";
import { PracticeRunClient } from "../../practice-client";

export const metadata = { title: "Practice" };

export const dynamic = "force-dynamic";

export default async function SkyPracticeRunPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sample = params.sample !== undefined;
  let recipe: Recipe = EMPTY_RECIPE;
  try { recipe = { ...EMPTY_RECIPE, ...(JSON.parse(String(params.recipe ?? "{}")) as Partial<Recipe>) }; } catch { /* a bad recipe runs as everything */ }
  const named = String(params.cards ?? "").split(",").filter(Boolean);
  const userId = sample ? null : await currentUserId();
  const who = sample ? { sample: true } : userId ? {} : null;
  // the client's own misses are not known here, so the draw's shakiest-first
  // order leans on the schedule's misses alone
  // the deck and the run left part way through at the same time (SAK-404);
  // a visitor's run is in their browser, so there is nothing to read here
  const [initial, accountRun] = await Promise.all([
    who ? (named.length ? loadQuiz(who, { cards: named }) : loadPracticeCards(who, recipe)) : null,
    sample || !userId ? null : loadQuizRun(),
  ]);
  return (
    <>
      <PracticeRunClient initial={initial} named={named} sample={sample} signedIn={userId !== null} recipe={recipe} accountRun={accountRun} />
      <ServerTimingMeta />
    </>
  );
}
