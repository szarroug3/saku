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
  const { active, restored } = useQuizSession();

  // Landing here with no quiz (deep link, or refresh with nothing stored) →
  // setup. Wait for the sessionStorage restore so refreshes resume instead.
  useEffect(() => {
    if (restored && !active) router.replace("/");
  }, [restored, active, router]);
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
