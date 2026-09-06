"use client";

// The Quiz's client side: SkyQuiz with the app's own grader handed in.
// A server component cannot pass a function to a client one, so this thin
// client wrapper imports the matcher itself (the same one the app's drill
// uses: the fact's own check, romaji to kana, English synonyms) and grades
// on the client, with no round trip per answer. Right or wrong, nothing in
// between: a near miss gets another try instead (Sam, 2026-09-05).
//
// A lesson's quiz runs three rounds over the same cards with a rest
// between them (SAK-343): the round's results offer the rest, the rest
// screen counts down from a timestamp kept in the browser (so a reload
// resumes it), and the next round starts fresh over the same cards. The
// rest lengths are the learner's settings.

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { HearButton } from "@/components/ui/hear-button";
import { Info } from "@/components/ui";
import { checkTyped } from "@/lib/engine";
import { useQuizConfig } from "@/lib/quiz-config";
import { romajiMatches } from "@/lib/romaji";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import { SkyRest } from "@/sky/components/sky-rest";
import type { QuizAnswer, QuizCard } from "@/sky/lib/quiz";
import { restMinutes, type RestState } from "@/sky/lib/rest";
import type { Direction, FactId, QuizConfig } from "@/types";

import { PitchMark } from "./pitch-reading";
import { useStored, writeStored } from "./stored";

/** Whether `given` answers the card. A rolled counting card (say 六十七)
 * carries its own accepted readings; everything else asks the fact. */
/** The retries setting as the quiz shows it (0 is none), and back. */
export function retriesOf(cfg: QuizConfig): number {
  return cfg.retries === "none" ? 0 : cfg.retries === "unl" ? 9 : cfg.retryN;
}
export function retriesPatch(n: number): Partial<QuizConfig> {
  return n === 0 ? { retries: "none" } : { retries: "lim", retryN: n };
}

export function grade(card: QuizCard, given: string): boolean {
  if (card.meta?.accept) return card.meta.accept.split("|").some((a) => romajiMatches(given, a));
  return checkTyped(card.id as FactId, given, (card.meta?.dir ?? "jp2en") as Direction);
}

/** The app's info mark, restyled for the wash. */
export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return <Info label={label} className="ml-1.5 border-sky-accent text-sky-accent hover:bg-sky-accent/15">{children}</Info>;
}

const REST_KEY = "sky:quiz:rest";
const NO_REST: RestState | null = null;

export function QuizClient({ cards, skyHref, sample = false, onFinish, rounds = 1 }: { cards: readonly QuizCard[]; skyHref: string; sample?: boolean; onFinish?: (answers: readonly QuizAnswer[]) => Promise<void>; rounds?: number }) {
  const router = useRouter();
  const { cfg, update } = useQuizConfig();
  const deck = cards.map((c) => c.id).join("\n");
  // the rest between rounds, kept in the browser: the round that ended and
  // when its rest is over. Only this deck's counts.
  const stored = useStored<RestState | null>(REST_KEY, NO_REST);
  const rest = stored && stored.deck === deck && stored.round < rounds ? stored : null;
  // the round begun on this page since the last rest; null means the page
  // opened onto the rest (or onto round one)
  const [started, setStarted] = useState<number | null>(null);
  const round = started ?? (rest ? rest.round : 0) + (rest ? 0 : 1);
  const resting = !!rest && started === null;

  // a retry is the same route with just those cards named
  const retry = (ids: readonly string[]) => router.push(`/dev/sky/quiz?${sample ? "sample&" : ""}cards=${encodeURIComponent(ids.join(","))}`);
  const finish = async (answers: readonly QuizAnswer[]) => {
    if (onFinish) await onFinish(answers);
    if (round >= rounds) writeStored(REST_KEY, null);
  };
  const takeRest = () => {
    const startedAt = Date.now();
    writeStored(REST_KEY, { deck, round, startedAt, until: startedAt + restMinutes(round + 1, cfg.restFirstMin, cfg.restThenMin) * 60_000 } satisfies RestState);
    setStarted(null);
  };
  const startNext = () => setStarted((rest?.round ?? round) + 1);
  // the rest length is changed on the rest screen itself: it is the setting
  // (the first rest, or every one after), and this rest re-counts from its start
  const setMinutes = (n: number) => {
    if (!rest) return;
    update(rest.round + 1 <= 2 ? { restFirstMin: n } : { restThenMin: n });
    writeStored(REST_KEY, { ...rest, until: rest.startedAt + n * 60_000 } satisfies RestState);
  };

  if (resting) return <SkyRest until={rest.until} nextRound={rest.round + 1} rounds={rounds} onStart={startNext} minutes={restMinutes(rest.round + 1, cfg.restFirstMin, cfg.restThenMin)} onMinutes={setMinutes} skyHref={skyHref} height="100%" />;
  const next = round < rounds ? { label: `Take a rest, then round ${round + 1} of ${rounds}`, onClick: takeRest } : undefined;
  // keyed by its cards and round, so a retry or the next round starts fresh
  return <SkyQuiz key={`${deck}\n${round}`} cards={cards} grade={grade} onFinish={finish} skyHref={skyHref} hear={HearButton} pitch={PitchMark} tip={Tip} onRetry={retry} next={next} retries={retriesOf(cfg)} onRetries={(n) => update(retriesPatch(n))} timerSeconds={cfg.timer ? cfg.timerSec : 0} height="100%" />;
}
