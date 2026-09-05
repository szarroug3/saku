"use client";

// Practice's client side: the recipe page with its saved recipes and its own
// misses, both kept in the browser and nowhere near the schedule (SAK-318);
// the run is the Quiz's own screen with a recorder that only notes misses.
// A server component cannot pass a function to a client one, so the route
// hands in a bound lookup and this file does the navigating.

import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";

import { HearButton } from "@/components/ui/hear-button";
import { SkyPractice } from "@/sky/components/sky-practice";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import type { PracticeCollection, PracticeMisses, PracticePreview, Recipe, SavedRecipe } from "@/sky/lib/practice";
import type { QuizAnswer, QuizCard } from "@/sky/lib/quiz";

import { PitchMark } from "./pitch-reading";
import { grade, Tip } from "./quiz-client";

const SAVED_KEY = "sky:practice:recipes";
const MISSES_KEY = "sky:practice:misses";

const CHANGED = "sky:practice:changed";

function read<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* a browser with no storage keeps nothing */ }
  window.dispatchEvent(new Event(CHANGED));
}

/** A value kept in the browser, read the way React likes an outside store
 * read: nothing on the server, the stored text on the client, re-read when
 * it is written. */
function useStored<T>(key: string, fallback: T): T {
  const raw = useSyncExternalStore(
    (onChange) => { window.addEventListener(CHANGED, onChange); window.addEventListener("storage", onChange); return () => { window.removeEventListener(CHANGED, onChange); window.removeEventListener("storage", onChange); }; },
    () => { try { return window.localStorage.getItem(key); } catch { return null; } },
    () => null,
  );
  return useMemo(() => { try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } }, [raw, fallback]);
}

const NO_SAVED: readonly SavedRecipe[] = [];
const NO_MISSES: PracticeMisses = {};

/** The recipe in a URL, and back. */
export const packRecipe = (recipe: Recipe) => encodeURIComponent(JSON.stringify(recipe));

export function PracticeClient({ collections, sample, initial, lookup, toSave }: { collections: readonly PracticeCollection[]; sample: boolean; initial: { recipe: Recipe; preview: PracticePreview }; lookup: (recipe: Recipe, misses: PracticeMisses) => Promise<PracticePreview>; toSave?: Recipe }) {
  const router = useRouter();
  const saved = useStored<readonly SavedRecipe[]>(SAVED_KEY, NO_SAVED);
  const misses = useStored<PracticeMisses>(MISSES_KEY, NO_MISSES);
  const onSaved = (next: readonly SavedRecipe[]) => write(SAVED_KEY, next);
  const onStart = (recipe: Recipe, dropped: readonly string[]) => router.push(`/dev/sky/practice/run?${sample ? "sample&" : ""}recipe=${packRecipe(recipe)}${dropped.length ? `&dropped=${encodeURIComponent(dropped.join(","))}` : ""}`);
  return <SkyPractice collections={collections} lookup={lookup} initial={initial} misses={misses} saved={saved} onSaved={onSaved} onStart={onStart} toSave={toSave} height="100%" />;
}

/** A practice run: the Quiz's screen, with answers kept as misses only. The
 * recorder is a plain client function, so there is no path from here to the
 * schedule at all. */
export function PracticeRunClient({ cards, sample, recipe }: { cards: readonly QuizCard[]; sample: boolean; recipe: Recipe }) {
  const router = useRouter();
  const back = `/dev/sky/practice${sample ? "?sample" : ""}`;
  const noteMisses = async (answers: readonly QuizAnswer[]) => {
    const misses = { ...read<Record<string, number>>(MISSES_KEY, {}) };
    for (const a of answers) if (a.grade === "missed") misses[a.cardId] = (misses[a.cardId] ?? 0) + 1;
    write(MISSES_KEY, misses);
  };
  const retry = (ids: readonly string[]) => router.push(`/dev/sky/practice/run?${sample ? "sample&" : ""}recipe=${packRecipe(recipe)}&cards=${encodeURIComponent(ids.join(","))}`);
  const save = () => router.push(`${back}${sample ? "&" : "?"}save=${packRecipe(recipe)}`);
  return <SkyQuiz key={cards.map((c) => c.id).join("\n")} cards={cards} grade={grade} onFinish={noteMisses} skyHref={back} hear={HearButton} pitch={PitchMark} tip={Tip} onRetry={retry} onSave={save} noNarrowing={recipe.noNarrowing} height="100%" />;
}
