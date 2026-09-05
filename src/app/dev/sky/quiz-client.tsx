"use client";

// The Quiz's client side: SkyQuiz with the app's own graders handed in.
// A server component cannot pass a function to a client one, so this thin
// client wrapper imports the matchers itself (the same ones the app's drill
// uses: the fact's own check, romaji to kana, English synonyms) and grades
// on the client, with no round trip per answer. A near miss is an answer
// within edit distance 2 of an accepted form (SAK-314).

import { HearButton } from "@/components/ui/hear-button";
import { checkTyped } from "@/lib/engine";
import { levenshtein } from "@/lib/engine/en-match";
import { factInfo } from "@/lib/facts";
import { toHiragana, toKana } from "@/lib/romaji";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import type { QuizAnswer, QuizCard, Verdict } from "@/sky/lib/quiz";
import type { Direction, FactId } from "@/types";

import { PitchMark } from "./pitch-reading";

const NEAR = 2;

/** Whether `given` answers the card, and if not, whether it nearly did. */
function grade(card: QuizCard, given: string): Verdict {
  const fact = card.id as FactId;
  const dir = (card.meta?.dir ?? "jp2en") as Direction;
  if (checkTyped(fact, given, dir)) return { ok: true, nearly: false };
  const info = factInfo(fact);
  const forms = card.answerIs === "reading"
    ? [card.answer, ...(dir === "en2jp" ? (info?.answers ?? []) : [])].map((s) => toHiragana(toKana(s)))
    : (info?.answers ?? [card.answer]).map((s) => s.toLowerCase().trim());
  const typed = card.answerIs === "reading" ? toHiragana(toKana(given.trim())) : given.toLowerCase().trim();
  const nearly = typed.length > 1 && forms.some((f) => levenshtein(typed, f) <= NEAR && levenshtein(typed, f) < f.length);
  return { ok: false, nearly };
}

export function QuizClient({ cards, skyHref, onFinish }: { cards: readonly QuizCard[]; skyHref: string; onFinish?: (answers: readonly QuizAnswer[]) => Promise<void> }) {
  return <SkyQuiz cards={cards} grade={grade} onFinish={onFinish} skyHref={skyHref} hear={HearButton} pitch={PitchMark} height="100%" />;
}
