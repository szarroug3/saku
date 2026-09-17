"use client";

// Practice's client side: the recipe page with its saved recipes, kept in the
// browser and pushed up as the `practice` field of the learner's settings
// (SAK-342), so they follow the learner across devices; the run is the Quiz's
// own screen, with the Quiz's own recorder behind it (SAK-441).
// A server component cannot pass a function to a client one, so the route
// hands in a bound lookup and this file does the navigating.

import { useRouter } from "next/navigation";

import { useCallback, useMemo, useState } from "react";

import { HearButton } from "./hear-button";
import { useQuizConfig } from "@/lib/quiz-config";
import { PRACTICE_SAVED_KEY } from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import { ResumeAsk } from "@/sky/components/quiz-resume";
import { SkyPractice } from "@/sky/components/sky-practice";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import { EMPTY_RECIPE, recipeKey, sameRecipe, type PracticeCollection, type PracticePreview, type Recipe, type SavedRecipe } from "@/sky/lib/practice";
import type { QuizAnswer, QuizCard } from "@/sky/lib/quiz";
import { orderDeck, resumeAt, runToKeep, sameSource, trimRun, type RunSource, type SavedRun } from "@/sky/lib/quiz-run";

import { PitchMark } from "./pitch-reading";
import { loadPracticeCards, loadQuiz, practiceLookup } from "./actions";
import { runHref, skyHref } from "./hrefs";
import { useSkyData } from "./local";
import { grade } from "./grade";
import { keepRun, useRunAtOpen } from "./quiz-run-store";
import { typeKana } from "./typing";
import { retriesOf, retriesPatch } from "./retries";
import { useStored, writeStored } from "./stored";
import { recordAnswers } from "./writes";
import type { Who } from "./who";

const SAVED_KEY = PRACTICE_SAVED_KEY;

/** Writes the browser's copy of the saved recipes, then pushes it up.
 *
 * Practice used to keep a second thing here, its own count of what had been
 * missed, and the two halves were written at different moments by whichever
 * device was in front of the learner (SAK-377). A practice run is recorded
 * now (SAK-441), so the history holds the misses and this is one value again:
 * the recipes, written whole, last write winning like every other setting. */
function saveRecipes(next: readonly SavedRecipe[]) {
  writeStored(SAVED_KEY, next);
  pushSettings({ practice: { saved: [...next] } });
}

const NO_SAVED: readonly SavedRecipe[] = [];

// The headings, written once each: the loading screen draws the same eyebrow
// and title the loaded page does, so the two renders are one page rather than
// two (SAK-356), which only holds while both read the same string.
const PICK_TITLE = "What would you like to practice?";
const RUN_TITLE = "Your practice deck";

export function PracticeClient({ collections, sample, signedIn, initialPreview }: { collections: readonly PracticeCollection[]; sample: boolean; signedIn: boolean; initialPreview: PracticePreview | null }) {
  const router = useRouter();
  const saved = useStored<readonly SavedRecipe[]>(SAVED_KEY, NO_SAVED);
  const loadFirst = useCallback((w: Who) => practiceLookup(w, EMPTY_RECIPE), []);
  const { who, data: preview, loading } = useSkyData({ sample, signedIn, load: loadFirst, initial: initialPreview, eyebrow: "Practice", title: PICK_TITLE });
  const lookup = useCallback((recipe: Recipe) => practiceLookup(who ?? {}, recipe), [who]);
  if (!preview) return loading;
  const initial = { recipe: EMPTY_RECIPE, preview };
  const onStart = (recipe: Recipe) => router.push(skyHref("/practice/run", { sample, recipe }));
  return <SkyPractice collections={collections} lookup={lookup} initial={initial} saved={saved} onSaved={saveRecipes} onStart={onStart} />;
}

/** A practice run: the Quiz's screen, and the Quiz's recorder behind it
 * (SAK-441). Every answer goes through `recordAnswers`, so a practice deck
 * moves the schedule and the standings exactly as a quiz does.
 *
 * A practice deck is a run like any other, so it is written down and picked
 * up the same way (SAK-404). What it was asked from is its recipe, as the key
 * `recipeKey` makes of it, which is what sends the "Continue where you left
 * off?" line back here rather than to the quiz. */
export function PracticeRunClient({ initial, named, sample, signedIn, recipe, accountRun = null }: { initial: readonly QuizCard[] | null; named: readonly string[]; sample: boolean; signedIn: boolean; recipe: Recipe; accountRun?: SavedRun | null }) {
  const router = useRouter();
  const { cfg, update } = useQuizConfig();
  const source = useMemo<RunSource>(() => ({ ...(named.length ? { cards: named } : {}), recipe: recipeKey(recipe) }), [named, recipe]);
  const local = useRunAtOpen();
  const savedRun = sample ? null : (local ?? accountRun);
  const [replaced, setReplaced] = useState(false);
  const clash = savedRun && !sameSource(savedRun.from, source) ? savedRun : null;
  const resume = clash ? null : savedRun;
  // the deck as one string, so writing the run down after every answer does
  // not re-deal it underneath whoever is answering (see quiz-client.tsx)
  const deckKey = resume ? resume.deck.join("\n") : "";
  const deck = useMemo(() => (deckKey ? deckKey.split("\n") : null), [deckKey]);
  // the deck honors the same two Settings the lesson quiz does (SAK-426)
  const load = useCallback((w: Who) => deck ? loadQuiz(w, { cards: deck }) : named.length ? loadQuiz(w, { cards: named }) : loadPracticeCards(w, recipe, { audio: cfg.audioPrompts, pitch: cfg.pitchQuestions }), [deck, named, recipe, cfg.audioPrompts, cfg.pitchQuestions]);
  const { data: loaded, loading } = useSkyData({ sample, signedIn, load, initial: deck ? null : initial, eyebrow: "Quiz", title: RUN_TITLE });
  const cards = useMemo(() => (loaded && deck ? orderDeck(loaded, deck) : loaded), [loaded, deck]);
  const run = useMemo(() => (resume && cards ? trimRun(resume, cards.map((c) => c.id)) : null), [resume, cards]);
  // the browser has not been asked yet, so which deck this page deals is not
  // known; the heading is drawn while the rest catches up (SAK-356)
  if (local === undefined) return loading;
  if (clash && !replaced) {
    return <ResumeAsk run={clash} href={runHref(clash.from, sample)} title={RUN_TITLE} onStart={() => setReplaced(true)} onKeep={(href) => router.push(href)} />;
  }
  if (!cards) return loading;
  return <PracticeRun cards={cards} run={run} source={source} sample={sample} signedIn={signedIn} recipe={recipe} cfg={cfg} update={update} router={router} />;
}

function PracticeRun({ cards, run, source, sample, signedIn, recipe, cfg, update, router }: { cards: readonly QuizCard[]; run: SavedRun | null; source: RunSource; sample: boolean; signedIn: boolean; recipe: Recipe; cfg: ReturnType<typeof useQuizConfig>["cfg"]; update: ReturnType<typeof useQuizConfig>["update"]; router: ReturnType<typeof useRouter> }) {
  const back = { href: skyHref("/practice", { sample }), label: "Back to practice" };
  const saved = useStored<readonly SavedRecipe[]>(SAVED_KEY, NO_SAVED);
  // what this deck is called, when the learner has called it something: the
  // saved recipe it matches, so the row under Sessions says "Evening drill"
  const named = saved.find((d) => sameRecipe(d.recipe, recipe))?.name;
  // The sample records nothing, the way it records nothing everywhere else,
  // and the results screen stays quiet about saving rather than claiming a
  // run that went nowhere.
  const finish = sample ? undefined : async (answers: readonly QuizAnswer[]) => {
    // the run is over the moment the answers go to the recorder: nothing to
    // come back to, so nothing kept (SAK-404)
    keepRun(null, signedIn);
    await recordAnswers(answers, named ? { name: named } : {});
  };
  const progress = (at: number, answers: readonly QuizAnswer[]) => {
    if (sample) return;
    keepRun(runToKeep(cards.map((c) => c.id), at, answers, source, Date.now()), signedIn);
  };
  const retry = (ids: readonly string[]) => router.push(skyHref("/practice/run", { sample, recipe, cards: ids }));
  // Saved here, on the results, rather than by navigating back to Practice
  // with the recipe in the query and throwing the results away (SAK-395).
  const save = (name: string) => saveRecipes([...saved.filter((d) => d.name !== name), { name, recipe }]);
  return <SkyQuiz key={cards.map((c) => c.id).join("\n")} cards={cards} grade={grade} toKana={typeKana} hear={HearButton} pitch={PitchMark} results={{ back, ...(finish ? { onFinish: finish } : {}), onRetry: retry, onSave: save, savedNames: saved.map((d) => d.name) }} title={RUN_TITLE} run={{ at: run ? resumeAt(run) : 0, answers: run?.answers, onProgress: (state) => progress(state.at, state.answers) }} settings={{ retries: retriesOf(cfg), onRetries: (n) => update(retriesPatch(n)), timerSeconds: cfg.timer ? cfg.timerSec : 0 }} />;
}
