"use client";

// The Quiz's client side: SkyQuiz with the app's own grader handed in.
// A server component cannot pass a function to a client one, so this thin
// client wrapper imports the matcher itself (the same one the app's drill
// uses: the fact's own check, romaji to kana, English synonyms) and grades
// on the client, with no round trip per answer. Right or wrong, nothing in
// between: a near miss gets another try instead (Sam, 2026-09-05).

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Info } from "@/components/ui";
import { HearButton } from "@/components/ui/hear-button";
import { checkTyped } from "@/lib/engine";
import { romajiMatches } from "@/lib/romaji";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import type { QuizAnswer, QuizCard } from "@/sky/lib/quiz";
import type { Direction, FactId } from "@/types";

import { PitchMark } from "./pitch-reading";

/** Whether `given` answers the card. A rolled counting card (say 六十七)
 * carries its own accepted readings; everything else asks the fact. */
function grade(card: QuizCard, given: string): boolean {
  if (card.meta?.accept) return card.meta.accept.split("|").some((a) => romajiMatches(given, a));
  return checkTyped(card.id as FactId, given, (card.meta?.dir ?? "jp2en") as Direction);
}

/** The app's info mark, restyled for the wash. */
function Tip({ label, children }: { label: string; children: ReactNode }) {
  return <Info label={label} className="ml-1.5 border-sky-accent text-sky-accent hover:bg-sky-accent/15">{children}</Info>;
}

export function QuizClient({ cards, skyHref, sample = false, onFinish }: { cards: readonly QuizCard[]; skyHref: string; sample?: boolean; onFinish?: (answers: readonly QuizAnswer[]) => Promise<void> }) {
  const router = useRouter();
  // a retry is the same route with just those cards named
  const retry = (ids: readonly string[]) => router.push(`/dev/sky/quiz?${sample ? "sample&" : ""}cards=${encodeURIComponent(ids.join(","))}`);
  // keyed by its cards, so a retry (the same route, other cards) starts fresh
  return <SkyQuiz key={cards.map((c) => c.id).join("\n")} cards={cards} grade={grade} onFinish={onFinish} skyHref={skyHref} hear={HearButton} pitch={PitchMark} tip={Tip} onRetry={retry} height="100%" />;
}
