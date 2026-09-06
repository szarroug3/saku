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
import { useCallback, useState } from "react";

import { HearButton } from "@/components/ui/hear-button";
import { useQuizConfig } from "@/lib/quiz-config";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import { SkyRest } from "@/sky/components/sky-rest";
import type { QuizAnswer, QuizCard } from "@/sky/lib/quiz";
import { restMinutes, type RestState } from "@/sky/lib/rest";
import type { QuizConfig } from "@/types";

import { loadQuiz } from "./actions";
import { grade } from "./grade";
import { retriesOf, retriesPatch } from "./retries";
import { SkyLoading, useLoaded, useWho } from "./local";
import { PitchMark } from "./pitch-reading";
import { useStored, writeStored } from "./stored";
import { recordAnswers } from "./writes";

const REST_KEY = "sky:quiz:rest";
const NO_REST: RestState | null = null;

export function QuizClient({ initial, picks, named, skyHref, sample = false, signedIn, rounds = 1 }: { initial: readonly QuizCard[] | null; picks: readonly string[]; named: readonly string[]; skyHref: string; sample?: boolean; signedIn: boolean; rounds?: number }) {
  const router = useRouter();
  const { cfg, update } = useQuizConfig();
  const who = useWho(sample, signedIn);
  const load = useCallback((w: Parameters<typeof loadQuiz>[0]) => loadQuiz(w, { picks, cards: named, audio: cfg.audioPrompts, pitch: cfg.pitchQuestions }), [picks, named, cfg.audioPrompts, cfg.pitchQuestions]);
  const cards = useLoaded(who, load, initial);
  if (!cards) return <SkyLoading />;
  return <QuizRun cards={cards} skyHref={skyHref} sample={sample} rounds={rounds} cfg={cfg} update={update} router={router} />;
}

function QuizRun({ cards, skyHref, sample, rounds, cfg, update, router }: { cards: readonly QuizCard[]; skyHref: string; sample: boolean; rounds: number; cfg: QuizConfig; update: (patch: Partial<QuizConfig>) => void; router: ReturnType<typeof useRouter> }) {
  const onFinish = sample ? undefined : recordAnswers;
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
  const retry = (ids: readonly string[]) => router.push(`/quiz?${sample ? "sample&" : ""}cards=${encodeURIComponent(ids.join(","))}`);
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
  return <SkyQuiz key={`${deck}\n${round}`} cards={cards} grade={grade} onFinish={finish} skyHref={skyHref} hear={HearButton} pitch={PitchMark} onRetry={retry} next={next} retries={retriesOf(cfg)} onRetries={(n) => update(retriesPatch(n))} timerSeconds={cfg.timer ? cfg.timerSec : 0} height="100%" />;
}
