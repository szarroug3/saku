"use client";

// Home — the quiz builder. Mode/direction/style/length options, the
// character picker, a live subtitle, and the Start button. When a quiz is
// already running (tab-switching keeps it alive), the primary action becomes
// "Resume quiz" with an explicit discard-and-restart underneath.

import { useRouter } from "next/navigation";

import { CharacterPicker } from "@/components/home/character-picker";
import { QuizOptionsCard } from "@/components/home/quiz-options-card";
import { Btn, PageTitle, PrimaryBtn } from "@/components/ui";
import { SETS } from "@/data/characters";
import { selectedChars, useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";

export default function HomePage() {
  const router = useRouter();
  const { cfg } = useQuizConfig();
  const { active, startQuiz, abandonQuiz } = useQuizSession();

  const chars = selectedChars(cfg);
  const n = chars.length;
  const modeLabel =
    cfg.mode === "pairs" ? "Match pairs" : cfg.mode === "grid" ? "Grid" : "Drill";
  const scriptParts = SETS.filter((set) =>
    set.sections.some((sec) => sec.chars.some((c) => cfg.enabled[c.c])),
  ).map((s) => s.label.toLowerCase());
  const sub = `${modeLabel} · ${
    scriptParts.length ? scriptParts.join(" + ") : "no characters"
  } · ${n} characters selected`;

  // Grid mode ignores directions, so only the char count gates it there.
  const startDisabled =
    n === 0 || (cfg.mode !== "grid" && !cfg.dirs.jp2en && !cfg.dirs.en2jp);

  const discardAndStart = () => {
    if (!window.confirm("Discard the quiz in progress and start a new one?")) {
      return;
    }
    abandonQuiz();
    startQuiz(chars);
  };

  return (
    <>
      <PageTitle title="Kana quiz" sub={sub} />
      <QuizOptionsCard />
      <CharacterPicker />
      {active ? (
        <>
          <PrimaryBtn onClick={() => router.push("/quiz")}>
            Resume quiz
          </PrimaryBtn>
          <Btn
            className="mt-2.5 w-full disabled:cursor-default disabled:opacity-45"
            disabled={startDisabled}
            onClick={discardAndStart}
          >
            Discard &amp; start new quiz
          </Btn>
        </>
      ) : (
        <PrimaryBtn disabled={startDisabled} onClick={() => startQuiz(chars)}>
          Start Quiz
        </PrimaryBtn>
      )}
    </>
  );
}
