"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DrillScreen } from "@/components/quiz/drill-screen";
import { GridScreen } from "@/components/quiz/grid-screen";
import { PairsScreen } from "@/components/quiz/pairs-screen";
import { useQuizSession } from "@/lib/quiz-session";

// The active-quiz route: renders the screen for the quiz's SNAPSHOT mode
// (never cfg.mode — changing Mode on Home mid-quiz must not flip a running
// quiz). Screens persist their state in active.runtime, so leaving this
// route and coming back resumes mid-question.
export default function QuizPage() {
  const router = useRouter();
  const { active, results, restored } = useQuizSession();

  // Landing here with no quiz (deep link, or refresh with nothing stored) →
  // setup. Wait for the restore so a refresh resumes instead.
  //
  // `results` is why this isn't just `!active`: finishing a quiz clears active
  // AND pushes /results, but clearing active re-renders this page first — so
  // this effect fired and replace("/") beat the push, landing you on Home
  // instead of your results. If there are results to show, the finish is
  // already navigating; this guard has no business redirecting anywhere.
  useEffect(() => {
    if (restored && !active && !results) router.replace("/");
  }, [restored, active, results, router]);
  if (!active) return null;

  switch (active.snapshot.mode) {
    case "drill":
      return <DrillScreen />;
    case "pairs":
      return <PairsScreen />;
    case "grid":
      return <GridScreen />;
  }
}
