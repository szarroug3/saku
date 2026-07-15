"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";

// The active-quiz route: renders the screen for cfg.mode. Mode screens are
// client components owned by the drill / pairs+grid agents.
// TODO(agent:drill): <DrillScreen />
// TODO(agent:pairs-grid): <PairsScreen /> and <GridScreen />
export default function QuizPage() {
  const router = useRouter();
  const { active } = useQuizSession();
  const { cfg } = useQuizConfig();

  // Landing here without a started quiz (refresh, deep link) → setup.
  useEffect(() => {
    if (!active) router.replace("/");
  }, [active, router]);
  if (!active) return null;

  switch (cfg.mode) {
    case "drill":
      return <p className="text-text-muted">Drill screen coming up.</p>;
    case "pairs":
      return <p className="text-text-muted">Match pairs screen coming up.</p>;
    case "grid":
      return <p className="text-text-muted">Grid screen coming up.</p>;
  }
}
