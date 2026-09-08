"use client";

// Practice's client side: the recipe page with its saved recipes and its own
// misses, kept in the browser and pushed up as the `practice` field of the
// learner's settings (SAK-342), so they follow the learner across devices
// and stay nowhere near the schedule (SAK-318); the run is the Quiz's own
// screen with a recorder that only notes misses.
// A server component cannot pass a function to a client one, so the route
// hands in a bound lookup and this file does the navigating.

import { useRouter } from "next/navigation";

import { useCallback, useMemo, useState } from "react";

import { HearButton } from "./hear-button";
import { useQuizConfig } from "@/lib/quiz-config";
import { PRACTICE_MISSES_KEY, PRACTICE_SAVED_KEY } from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import { ResumeAsk } from "@/sky/components/quiz-resume";
import { SkyPractice } from "@/sky/components/sky-practice";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import { EMPTY_RECIPE, recipeKey, type PracticeCollection, type PracticeMisses, type PracticePreview, type Recipe, type SavedRecipe } from "@/sky/lib/practice";
import type { QuizAnswer, QuizCard } from "@/sky/lib/quiz";
import { orderDeck, resumeAt, runToKeep, sameSource, trimRun, type RunSource, type SavedRun } from "@/sky/lib/quiz-run";

import { PitchMark } from "./pitch-reading";
import { loadPracticeCards, loadQuiz, practiceLookup } from "./actions";
import { runHref, skyHref } from "./hrefs";
import { SkyLoading, useLoaded, useWho } from "./local";
import { grade } from "./grade";
import { keepRun, useRunAtOpen } from "./quiz-run-store";
import { typeKana } from "./typing";
import { retriesOf, retriesPatch } from "./retries";
import { readStored as read, useStored, writeStored } from "./stored";
import type { Who } from "./who";

const SAVED_KEY = PRACTICE_SAVED_KEY;
const MISSES_KEY = PRACTICE_MISSES_KEY;

/**
 * Writes the browser's copy, then pushes UP THE HALF THAT CHANGED (SAK-377).
 *
 * It used to push both halves every time, from this browser's own copies, and
 * the merge on the way in replaced the pair whole. So a laptop renaming a
 * recipe sent its own misses too, and if the phone had recorded some since
 * this laptop last synced, they were gone. The comment here claimed the
 * opposite; sending both was exactly what caused it.
 *
 * Saving a recipe now says only what it saved, and recording a miss says only
 * what it missed. `mergeSettings` keeps the other half and takes the larger
 * count per card.
 */
function write(key: string, value: unknown) {
  writeStored(key, value);
  pushSettings({
    practice: key === SAVED_KEY
      ? { saved: read<{ name: string; recipe: unknown }[]>(SAVED_KEY, []) }
      : { misses: read<Record<string, number>>(MISSES_KEY, {}) },
  });
}

const NO_SAVED: readonly SavedRecipe[] = [];
const NO_MISSES: PracticeMisses = {};

export function PracticeClient({ collections, sample, signedIn, initialPreview }: { collections: readonly PracticeCollection[]; sample: boolean; signedIn: boolean; initialPreview: PracticePreview | null }) {
  const router = useRouter();
  const saved = useStored<readonly SavedRecipe[]>(SAVED_KEY, NO_SAVED);
  const misses = useStored<PracticeMisses>(MISSES_KEY, NO_MISSES);
  const who = useWho(sample, signedIn);
  const loadFirst = useCallback((w: Who) => practiceLookup(w, EMPTY_RECIPE, {}), []);
  const preview = useLoaded(who, loadFirst, initialPreview);
  const lookup = useCallback((recipe: Recipe, m: PracticeMisses) => practiceLookup(who ?? {}, recipe, m), [who]);
  if (!preview) return <SkyLoading eyebrow="Practice" title={"What would you like to practice?"} />;
  const initial = { recipe: EMPTY_RECIPE, preview };
  const onSaved = (next: readonly SavedRecipe[]) => write(SAVED_KEY, next);
  const onStart = (recipe: Recipe) => router.push(skyHref("/practice/run", { sample, recipe }));
  return <SkyPractice collections={collections} lookup={lookup} initial={initial} misses={misses} saved={saved} onSaved={onSaved} onStart={onStart} height="100%" />;
}

/** A practice run: the Quiz's screen, with answers kept as misses only. The
 * recorder is a plain client function, so there is no path from here to the
 * schedule at all.
 *
 * A practice deck is a run like any other, so it is written down and picked
 * up the same way (SAK-404). What it was asked from is its recipe, as the key
 * `recipeKey` makes of it, which is what sends the "Continue where you left
 * off?" line back here rather than to the quiz. */
export function PracticeRunClient({ initial, named, sample, signedIn, recipe, accountRun = null }: { initial: readonly QuizCard[] | null; named: readonly string[]; sample: boolean; signedIn: boolean; recipe: Recipe; accountRun?: SavedRun | null }) {
  const router = useRouter();
  const { cfg, update } = useQuizConfig();
  const who = useWho(sample, signedIn);
  const source = useMemo<RunSource>(() => ({ ...(named.length ? { cards: named } : {}), recipe: recipeKey(recipe) }), [named, recipe]);
  const local = useRunAtOpen();
  const saved = sample ? null : (local ?? accountRun);
  const [replaced, setReplaced] = useState(false);
  const clash = saved && !sameSource(saved.from, source) ? saved : null;
  const resume = clash ? null : saved;
  // the deck as one string, so writing the run down after every answer does
  // not re-deal it underneath whoever is answering (see quiz-client.tsx)
  const deckKey = resume ? resume.deck.join("\n") : "";
  const deck = useMemo(() => (deckKey ? deckKey.split("\n") : null), [deckKey]);
  const load = useCallback((w: Who) => deck ? loadQuiz(w, { cards: deck }) : named.length ? loadQuiz(w, { cards: named }) : loadPracticeCards(w, recipe), [deck, named, recipe]);
  const loaded = useLoaded(who, load, deck ? null : initial);
  const cards = useMemo(() => (loaded && deck ? orderDeck(loaded, deck) : loaded), [loaded, deck]);
  const run = useMemo(() => (resume && cards ? trimRun(resume, cards.map((c) => c.id)) : null), [resume, cards]);
  // the browser has not been asked yet, so which deck this page deals is not
  // known; the heading is drawn while the rest catches up (SAK-356)
  if (local === undefined) return <SkyLoading eyebrow="Quiz" title={"Your practice deck"} />;
  if (clash && !replaced) {
    return <ResumeAsk run={clash} href={runHref(clash.from, sample)} title="Your practice deck" height="100%" onStart={() => setReplaced(true)} onKeep={(href) => router.push(href)} />;
  }
  if (!cards) return <SkyLoading eyebrow="Quiz" title={"Your practice deck"} />;
  return <PracticeRun cards={cards} run={run} source={source} sample={sample} signedIn={signedIn} recipe={recipe} cfg={cfg} update={update} router={router} />;
}

function PracticeRun({ cards, run, source, sample, signedIn, recipe, cfg, update, router }: { cards: readonly QuizCard[]; run: SavedRun | null; source: RunSource; sample: boolean; signedIn: boolean; recipe: Recipe; cfg: ReturnType<typeof useQuizConfig>["cfg"]; update: ReturnType<typeof useQuizConfig>["update"]; router: ReturnType<typeof useRouter> }) {
  const back = { href: skyHref("/practice", { sample }), label: "Back to practice" };
  const saved = useStored<readonly SavedRecipe[]>(SAVED_KEY, NO_SAVED);
  const noteMisses = async (answers: readonly QuizAnswer[]) => {
    if (!sample) keepRun(null, signedIn);
    const misses = { ...read<Record<string, number>>(MISSES_KEY, {}) };
    for (const a of answers) if (a.grade === "missed") misses[a.cardId] = (misses[a.cardId] ?? 0) + 1;
    write(MISSES_KEY, misses);
  };
  const progress = (at: number, answers: readonly QuizAnswer[]) => {
    if (sample) return;
    keepRun(runToKeep(cards.map((c) => c.id), at, answers, source, Date.now()), signedIn);
  };
  const retry = (ids: readonly string[]) => router.push(skyHref("/practice/run", { sample, recipe, cards: ids }));
  // Saved here, on the results, rather than by navigating back to Practice
  // with the recipe in the query and throwing the results away (SAK-395).
  const save = (name: string) => write(SAVED_KEY, [...saved.filter((d) => d.name !== name), { name, recipe }]);
  return <SkyQuiz key={cards.map((c) => c.id).join("\n")} cards={cards} grade={grade} toKana={typeKana} onFinish={noteMisses} back={back} hear={HearButton} pitch={PitchMark} onRetry={retry} onSave={save} savedNames={saved.map((d) => d.name)} title="Your practice deck" startAt={run ? resumeAt(run) : 0} startAnswers={run?.answers} onProgress={(state) => progress(state.at, state.answers)} retries={retriesOf(cfg)} onRetries={(n) => update(retriesPatch(n))} timerSeconds={cfg.timer ? cfg.timerSec : 0} height="100%" />;
}
