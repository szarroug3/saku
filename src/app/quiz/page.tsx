"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useQuizSession } from "@/lib/quiz-session";

// The active-quiz route: renders the screen for the quiz's SNAPSHOT mode
// (never cfg.mode — changing Mode on Home mid-quiz must not flip a running
// quiz). Mode screens are client components owned by the drill / pairs+grid
// agents; they persist their state in active.runtime so leaving this route
// and coming back resumes mid-question.
// TODO(agent:drill): <DrillScreen />
// TODO(agent:pairs-grid): <PairsScreen /> and <GridScreen />
export default function QuizPage() {
  const router = useRouter();
  const { active } = useQuizSession();

  // Landing here without a started quiz (refresh, deep link) → setup.
  useEffect(() => {
    if (!active) router.replace("/");
  }, [active, router]);
  if (!active) return null;

  switch (active.snapshot.mode) {
    case "drill":
      return <p className="text-text-muted">Drill screen coming up.</p>;
    case "pairs":
      return <p className="text-text-muted">Match pairs screen coming up.</p>;
    case "grid":
      return <p className="text-text-muted">Grid screen coming up.</p>;
  }
}
