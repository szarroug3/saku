"use client";

// Practice's client side: the recipe page with its saved recipes and its own
// misses, kept in the browser and pushed up as the `practice` field of the
// learner's settings (SAK-342), so they follow the learner across devices
// and stay nowhere near the schedule (SAK-318); the run is the Quiz's own
// screen with a recorder that only notes misses.
// A server component cannot pass a function to a client one, so the route
// hands in a bound lookup and this file does the navigating.

import { useRouter } from "next/navigation";

import { useCallback } from "react";

import { HearButton } from "@/components/ui/hear-button";
import { useQuizConfig } from "@/lib/quiz-config";
import { PRACTICE_MISSES_KEY, PRACTICE_SAVED_KEY } from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import { SkyPractice } from "@/sky/components/sky-practice";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import { EMPTY_RECIPE, type PracticeCollection, type PracticeMisses, type PracticePreview, type Recipe, type SavedRecipe } from "@/sky/lib/practice";
import type { QuizAnswer, QuizCard } from "@/sky/lib/quiz";

import { PitchMark } from "./pitch-reading";
import { loadPracticeCards, loadQuiz, practiceLookup } from "./actions";
import { SkyLoading, useLoaded, useWho } from "./local";
import { grade } from "./grade";
import { retriesOf, retriesPatch } from "./retries";
import { readStored as read, useStored, writeStored } from "./stored";
import type { Who } from "./who";

const SAVED_KEY = PRACTICE_SAVED_KEY;
const MISSES_KEY = PRACTICE_MISSES_KEY;

/** Writes the browser's copy, then pushes both halves up to the learner's
 * settings together, so one device's save never wipes another's misses. */
function write(key: string, value: unknown) {
  writeStored(key, value);
  pushSettings({ practice: { saved: read<{ name: string; recipe: unknown }[]>(SAVED_KEY, []), misses: read<Record<string, number>>(MISSES_KEY, {}) } });
}

const NO_SAVED: readonly SavedRecipe[] = [];
const NO_MISSES: PracticeMisses = {};

/** The recipe in a URL, and back. */
export const packRecipe = (recipe: Recipe) => encodeURIComponent(JSON.stringify(recipe));

export function PracticeClient({ collections, sample, signedIn, initialPreview, toSave }: { collections: readonly PracticeCollection[]; sample: boolean; signedIn: boolean; initialPreview: PracticePreview | null; toSave?: Recipe }) {
  const router = useRouter();
  const saved = useStored<readonly SavedRecipe[]>(SAVED_KEY, NO_SAVED);
  const misses = useStored<PracticeMisses>(MISSES_KEY, NO_MISSES);
  const who = useWho(sample, signedIn);
  const loadFirst = useCallback((w: Who) => practiceLookup(w, EMPTY_RECIPE, {}), []);
  const preview = useLoaded(who, loadFirst, initialPreview);
  const lookup = useCallback((recipe: Recipe, m: PracticeMisses) => practiceLookup(who ?? {}, recipe, m), [who]);
  if (!preview) return <SkyLoading />;
  const initial = { recipe: EMPTY_RECIPE, preview };
  const onSaved = (next: readonly SavedRecipe[]) => write(SAVED_KEY, next);
  const onStart = (recipe: Recipe) => router.push(`/practice/run?${sample ? "sample&" : ""}recipe=${packRecipe(recipe)}`);
  return <SkyPractice collections={collections} lookup={lookup} initial={initial} misses={misses} saved={saved} onSaved={onSaved} onStart={onStart} toSave={toSave} height="100%" />;
}

/** A practice run: the Quiz's screen, with answers kept as misses only. The
 * recorder is a plain client function, so there is no path from here to the
 * schedule at all. */
export function PracticeRunClient({ initial, named, sample, signedIn, recipe }: { initial: readonly QuizCard[] | null; named: readonly string[]; sample: boolean; signedIn: boolean; recipe: Recipe }) {
  const router = useRouter();
  const { cfg, update } = useQuizConfig();
  const who = useWho(sample, signedIn);
  const load = useCallback((w: Who) => named.length ? loadQuiz(w, { cards: named }) : loadPracticeCards(w, recipe), [named, recipe]);
  const cards = useLoaded(who, load, initial);
  if (!cards) return <SkyLoading />;
  return <PracticeRun cards={cards} sample={sample} recipe={recipe} cfg={cfg} update={update} router={router} />;
}

function PracticeRun({ cards, sample, recipe, cfg, update, router }: { cards: readonly QuizCard[]; sample: boolean; recipe: Recipe; cfg: ReturnType<typeof useQuizConfig>["cfg"]; update: ReturnType<typeof useQuizConfig>["update"]; router: ReturnType<typeof useRouter> }) {
  const back = `/practice${sample ? "?sample" : ""}`;
  const noteMisses = async (answers: readonly QuizAnswer[]) => {
    const misses = { ...read<Record<string, number>>(MISSES_KEY, {}) };
    for (const a of answers) if (a.grade === "missed") misses[a.cardId] = (misses[a.cardId] ?? 0) + 1;
    write(MISSES_KEY, misses);
  };
  const retry = (ids: readonly string[]) => router.push(`/practice/run?${sample ? "sample&" : ""}recipe=${packRecipe(recipe)}&cards=${encodeURIComponent(ids.join(","))}`);
  const save = () => router.push(`${back}${sample ? "&" : "?"}save=${packRecipe(recipe)}`);
  return <SkyQuiz key={cards.map((c) => c.id).join("\n")} cards={cards} grade={grade} onFinish={noteMisses} skyHref={back} hear={HearButton} pitch={PitchMark} onRetry={retry} onSave={save} retries={retriesOf(cfg)} onRetries={(n) => update(retriesPatch(n))} timerSeconds={cfg.timer ? cfg.timerSec : 0} height="100%" />;
}
