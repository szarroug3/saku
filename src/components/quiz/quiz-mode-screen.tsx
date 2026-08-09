"use client";

import dynamic from "next/dynamic";

import type { ActiveQuiz } from "@/lib/quiz-session";
import {
  quizScreenKind,
  type QuizScreenInput,
  type QuizScreenKind,
} from "@/components/quiz/quiz-screen-kind";

const screenLoaders = {
  drill: () => import("@/components/quiz/drill-screen"),
  pairs: () => import("@/components/quiz/pairs-screen"),
  grid: () => import("@/components/quiz/grid-screen"),
  assembly: () => import("@/components/quiz/assembly-screen"),
  substitution: () => import("@/components/quiz/substitution-screen"),
  "listen-sentence": () =>
    import("@/components/quiz/sentence-listen-screen"),
} satisfies Record<QuizScreenKind, () => Promise<unknown>>;

const DrillScreen = dynamic(() =>
  screenLoaders.drill().then((module) => module.DrillScreen),
);
const PairsScreen = dynamic(() =>
  screenLoaders.pairs().then((module) => module.PairsScreen),
);
const GridScreen = dynamic(() =>
  screenLoaders.grid().then((module) => module.GridScreen),
);
const AssemblyScreen = dynamic(() =>
  screenLoaders.assembly().then((module) => module.AssemblyScreen),
);
const SubstitutionScreen = dynamic(() =>
  screenLoaders.substitution().then((module) => module.SubstitutionScreen),
);
const SentenceListenScreen = dynamic(() =>
  screenLoaders["listen-sentence"]().then(
    (module) => module.SentenceListenScreen,
  ),
);

/** Download and parse the exact screen the next leg will use. Calling this
 * during a lesson or rest turns the final navigation into a cheap screen swap
 * instead of the point where the quiz UI first starts loading. */
export function preloadQuizScreen(quiz: QuizScreenInput): Promise<unknown> {
  return screenLoaders[quizScreenKind(quiz)]();
}

export function QuizModeScreen({ active }: { active: ActiveQuiz }) {
  switch (quizScreenKind(active)) {
    case "drill":
      return <DrillScreen />;
    case "pairs":
      return <PairsScreen />;
    case "grid":
      return <GridScreen />;
    case "assembly":
      return <AssemblyScreen />;
    case "substitution":
      return <SubstitutionScreen />;
    case "listen-sentence":
      return <SentenceListenScreen />;
  }
}
