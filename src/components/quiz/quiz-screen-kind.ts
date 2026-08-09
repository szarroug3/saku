import { englishSentenceAsksOrdering } from "@/lib/ask-config";
import type { ActiveQuiz } from "@/lib/quiz-session";
import { isSentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";

export type QuizScreenInput = Pick<ActiveQuiz, "facts" | "snapshot"> &
  Partial<Pick<ActiveQuiz, "runtime">>;

export type QuizScreenKind =
  | "drill"
  | "pairs"
  | "grid"
  | "assembly"
  | "substitution"
  | "listen-sentence";

/** Resolve the actual screen, including sentence-ordering drills that use the
 * assembly UI even though their stored quiz mode is `drill`. */
export function quizScreenKind(quiz: QuizScreenInput): QuizScreenKind {
  const sentenceOnlyDrill =
    quiz.snapshot.mode === "drill" &&
    quiz.facts.length > 0 &&
    quiz.facts.every(isSentenceTierMarkerFact) &&
    englishSentenceAsksOrdering(quiz.snapshot.ask);

  if (
    quiz.snapshot.mode === "drill" &&
    (quiz.runtime?.sentencePhase === true || sentenceOnlyDrill)
  ) {
    return "assembly";
  }
  return quiz.snapshot.mode;
}
