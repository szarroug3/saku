// A practice run. Route: /practice/run?recipe=… (`&cards=` a retry
// of named cards, `?sample` the pretend learner). The items left out by
// hand ride in the recipe. The deck is built here; the answers stay in the
// browser as misses and never reach the schedule (SAK-318).

import { currentUserId } from "@/lib/auth";
import { EMPTY_RECIPE, type Recipe } from "@/sky/lib/practice";

import { loadPracticeCards, loadQuiz } from "../../actions";
import { PracticeRunClient } from "../../practice-client";
import { SkyNote } from "../../sky-note";

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
  const initial = who ? (named.length ? await loadQuiz(who, { cards: named }) : await loadPracticeCards(who, recipe)) : null;
  return (
    <>
      <SkyNote>{sample ? "A pretend learner. Nothing is recorded, here or ever: practice never touches the schedule." : "Practice is never recorded against your review schedule."}</SkyNote>
      <PracticeRunClient initial={initial} named={named} sample={sample} signedIn={userId !== null} recipe={recipe} />
    </>
  );
}
