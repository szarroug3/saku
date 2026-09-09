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
// resumes it), and the next round starts fresh over the same cards, dealt
// in a new order (SAK-388). The rest lengths are the learner's settings.
//
// AND A RUN YOU LEAVE IS HERE WHEN YOU COME BACK (SAK-404). The run is
// written down after every answer (see quiz-run-store.ts) and read again
// when this page opens. A page opened on the same ask the run came from
// resumes it: the saved deck, in the order it was dealt, with the answers
// already given and the card it was left on. A page opened on a DIFFERENT
// ask asks first, since only one run is kept.

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { HearButton } from "./hear-button";
import { useQuizConfig } from "@/lib/quiz-config";
import { ResumeAsk } from "@/sky/components/quiz-resume";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import { SkyRest } from "@/sky/components/sky-rest";
import { shuffleDeck, type QuizAnswer, type QuizCard, type WayBack } from "@/sky/lib/quiz";
import { orderDeck, resumeAt, runToKeep, sameSource, trimRun, type RunSource, type SavedRun } from "@/sky/lib/quiz-run";
import { seeded } from "@/sky/lib/random";
import { restMinutes, type RestState } from "@/sky/lib/rest";
import type { QuizConfig } from "@/types";

import { loadQuiz } from "./actions";
import { grade } from "./grade";
import { runHref, skyHref } from "./hrefs";
import { typeKana } from "./typing";
import { retriesOf, retriesPatch } from "./retries";
import { SkyLoading, useLoaded, useWho } from "./local";
import { PitchMark } from "./pitch-reading";
import { keepRun, useRunAtOpen } from "./quiz-run-store";
import { useStored, writeStored } from "./stored";
import { recordAnswers } from "./writes";

const REST_KEY = "sky:quiz:rest";
const NO_REST: RestState | null = null;

const TITLE = "Tonight's drill";

export function QuizClient({ initial, picks, named, back, sample = false, signedIn, rounds = 1, accountRun = null }: { initial: readonly QuizCard[] | null; picks: readonly string[]; named: readonly string[]; back: WayBack; sample?: boolean; signedIn: boolean; rounds?: number; accountRun?: SavedRun | null }) {
  const router = useRouter();
  // What this page was asked for, in the same words a run records. Nothing
  // named at all is "what is due", which is a source like any other, so a
  // second visit to a bare /quiz matches the run a bare /quiz left.
  const source = useMemo<RunSource>(() => ({ ...(picks.length ? { picks } : {}), ...(named.length ? { cards: named } : {}) }), [picks, named]);
  // The browser's copy first: it is here without a round trip. The account's
  // is what the route read on the server, and stands in when this browser has
  // none (a cleared browser, another machine). The sample records nothing and
  // so leaves nothing.
  const local = useRunAtOpen();
  const saved = sample ? null : (local ?? accountRun);
  const [replaced, setReplaced] = useState(false);
  // a run of a different deck: only one is kept, so it is asked about once
  const clash = saved && !sameSource(saved.from, source) ? saved : null;
  // The browser has not been asked yet, so which deck this page deals is not
  // known. The heading is, and it is drawn while the rest catches up
  // (SAK-356), rather than dealing one deck and swapping it for another.
  if (local === undefined) return <SkyLoading eyebrow="Quiz" title={TITLE} />;
  if (clash && !replaced) {
    return <ResumeAsk run={clash} href={runHref(clash.from)} title={TITLE} height="100%" onStart={() => setReplaced(true)} onKeep={(href) => router.push(href)} />;
  }
  return <QuizDeck resume={clash ? null : saved} source={source} initial={initial} picks={picks} named={named} back={back} sample={sample} signedIn={signedIn} rounds={rounds} router={router} />;
}

/** The deck this page asks: the saved run's, in the order it was dealt, or
 * the one the route dealt. */
function QuizDeck({ resume, source, initial, picks, named, back, sample, signedIn, rounds, router }: { resume: SavedRun | null; source: RunSource; initial: readonly QuizCard[] | null; picks: readonly string[]; named: readonly string[]; back: WayBack; sample: boolean; signedIn: boolean; rounds: number; router: ReturnType<typeof useRouter> }) {
  const { cfg, update } = useQuizConfig();
  const who = useWho(sample, signedIn);
  // The deck as ONE STRING, and the array made from it. The run is rewritten
  // after every answer, so the saved object is a new one each time; taking
  // the deck straight off it would give `load` a new identity per answer and
  // re-deal the cards underneath whoever is answering them.
  const deckKey = resume ? resume.deck.join("\n") : "";
  const deck = useMemo(() => (deckKey ? deckKey.split("\n") : null), [deckKey]);
  const load = useCallback((w: Parameters<typeof loadQuiz>[0]) => loadQuiz(w, deck ? { cards: deck } : { picks, cards: named, audio: cfg.audioPrompts, pitch: cfg.pitchQuestions }), [deck, picks, named, cfg.audioPrompts, cfg.pitchQuestions]);
  const loaded = useLoaded(who, load, deck ? null : initial);
  // A named deck is dealt afresh (SAK-388), which is right for a retry and
  // wrong for a resume: the cards go back into the order they were asked in.
  const cards = useMemo(() => (loaded && deck ? orderDeck(loaded, deck) : loaded), [loaded, deck]);
  // and the run itself is trimmed to the cards that actually came back, since
  // the library moves under a run left overnight
  const run = useMemo(() => (resume && cards ? trimRun(resume, cards.map((c) => c.id)) : null), [resume, cards]);
  if (!cards) return <SkyLoading eyebrow="Quiz" title={TITLE} />;
  return <QuizRun cards={cards} run={run} source={source} back={back} sample={sample} signedIn={signedIn} rounds={rounds} cfg={cfg} update={update} router={router} />;
}

function QuizRun({ cards, run, source, back, sample, signedIn, rounds, cfg, update, router }: { cards: readonly QuizCard[]; run: SavedRun | null; source: RunSource; back: WayBack; sample: boolean; signedIn: boolean; rounds: number; cfg: QuizConfig; update: (patch: Partial<QuizConfig>) => void; router: ReturnType<typeof useRouter> }) {
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
  // Every round asks its own order (SAK-388). The first keeps the one the
  // deck came in, which is the order the server rendered, so hydration has
  // nothing to disagree with; the rounds after it deal again, or the second
  // and third are answered from the rhythm of the first. Seeded, not
  // Math.random: a re-render mid-round must not move the card underneath
  // whoever is answering it.
  const [seed] = useState(() => (Math.floor(Math.random() * 0x7fffffff) || 1));
  const asked = useMemo(() => (round <= 1 ? cards : shuffleDeck(cards, seeded(seed + round))), [cards, round, seed]);

  // a retry is the same route with just those cards named
  const retry = (ids: readonly string[]) => router.push(skyHref("/quiz", { sample, cards: ids }));
  const finish = async (answers: readonly QuizAnswer[]) => {
    // the run is over the moment the answers go to the recorder: nothing to
    // come back to, so nothing kept (SAK-404)
    if (!sample) keepRun(null, signedIn);
    if (onFinish) await onFinish(answers);
    if (round >= rounds) writeStored(REST_KEY, null);
  };
  // Where the run stands, written down after every answer. The sample keeps
  // nothing at all, the way it records nothing.
  //
  // ROUND ONE ONLY. A lesson's later rounds are the same deck dealt again
  // over a rest, and coming back to a page that offered round two of three as
  // "the run you left" would be a worse answer than coming back to no offer
  // at all. The rest itself already survives a reload on its own key.
  const progress = (at: number, answers: readonly QuizAnswer[]) => {
    if (sample || round > 1) return;
    keepRun(runToKeep(asked.map((c) => c.id), at, answers, source, Date.now()), signedIn);
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

  if (resting) return <SkyRest until={rest.until} nextRound={rest.round + 1} rounds={rounds} onStart={startNext} minutes={restMinutes(rest.round + 1, cfg.restFirstMin, cfg.restThenMin)} onMinutes={setMinutes} back={back} height="100%" />;
  const next = round < rounds ? { label: `Take a rest, then round ${round + 1} of ${rounds}`, onClick: takeRest } : undefined;
  // Only round one picks a run up: a run is one pass over one deck, and the
  // rounds after it are dealt again on purpose.
  const from = run && round <= 1 ? run : null;
  // keyed by its cards and round, so a retry or the next round starts fresh
  return <SkyQuiz key={`${deck}\n${round}`} cards={asked} grade={grade} toKana={typeKana} hear={HearButton} pitch={PitchMark} results={{ back, onFinish: finish, onRetry: retry, next }} run={{ at: from ? resumeAt(from) : 0, answers: from?.answers, onProgress: (state) => progress(state.at, state.answers) }} settings={{ retries: retriesOf(cfg), onRetries: (n) => update(retriesPatch(n)), timerSeconds: cfg.timer ? cfg.timerSec : 0 }} height="100%" />;
}
