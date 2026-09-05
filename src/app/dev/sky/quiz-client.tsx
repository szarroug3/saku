"use client";

// The Quiz's client side: SkyQuiz with the app's own grader handed in.
// A server component cannot pass a function to a client one, so this thin
// client wrapper imports the matcher itself (the same one the app's drill
// uses: the fact's own check, romaji to kana, English synonyms) and grades
// on the client, with no round trip per answer. Right or wrong, nothing in
// between: a near miss gets another try instead (Sam, 2026-09-05).

import { HearButton } from "@/components/ui/hear-button";
import { checkTyped } from "@/lib/engine";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import type { QuizAnswer, QuizCard } from "@/sky/lib/quiz";
import type { Direction, FactId } from "@/types";

import { PitchMark } from "./pitch-reading";

/** Whether `given` answers the card. */
function grade(card: QuizCard, given: string): boolean {
  return checkTyped(card.id as FactId, given, (card.meta?.dir ?? "jp2en") as Direction);
}

export function QuizClient({ cards, skyHref, onFinish }: { cards: readonly QuizCard[]; skyHref: string; onFinish?: (answers: readonly QuizAnswer[]) => Promise<void> }) {
  return <SkyQuiz cards={cards} grade={grade} onFinish={onFinish} skyHref={skyHref} hear={HearButton} pitch={PitchMark} height="100%" />;
}
