"use client";

// The Quiz's client side: SkyQuiz with the app's own grader handed in.
// A server component cannot pass a function to a client one, so this thin
// client wrapper imports the matcher itself (the same one the app's drill
// uses: the fact's own check, romaji to kana, English synonyms) and grades
// on the client, with no round trip per answer. Right or wrong, nothing in
// between: a near miss gets another try instead (Sam, 2026-09-05).
//
// A lesson's quiz runs three rounds over the same cards with a break
// between them (SAK-343): the round's results offer the break, the break
// screen counts down, and the next round starts fresh over the same cards,
// dealt in a new order (SAK-388). The break lengths are the learner's
// settings.
//
// AND A RUN YOU LEAVE IS HERE WHEN YOU COME BACK (SAK-404, SAK-444). Which
// slot of the saved place that run goes in depends on what this page is:
//
//   A LESSON'S DRILL -- a quiz asked for by picks, which is the one that runs
//   three rounds -- is the middle of a lesson's sitting. Its place is the
//   LESSON slot, and it writes the whole of that sitting there: which round,
//   the round's own deck and answers, and the break between two rounds with
//   its clock. So the one Continue button offers the lesson back wherever it
//   was left, which is the whole of what Sam sent SAK-444 back for. It never
//   reads or writes the quiz slot, so it can neither lose a quiz nor ask
//   about one.
//
//   ANY OTHER QUIZ -- what is due, a retry of named cards, a practice deck --
//   runs one round and keeps its run in the quiz slot, exactly as SAK-404 had
//   it. Arriving on a different ask while one is saved asks first, since only
//   one quiz is kept.

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { HearButton } from "./hear-button";
import { useQuizConfig } from "@/lib/quiz-config";
import { ResumeAsk } from "@/sky/components/quiz-resume";
import { SkyQuiz } from "@/sky/components/sky-quiz";
import { SkyRest } from "@/sky/components/sky-rest";
import { useNow } from "@/sky/components/use-now";
import { shuffleDeck, type QuizAnswer, type QuizCard, type WayBack } from "@/sky/lib/quiz";
import { hasPlace, lessonAt, lessonFor, NO_PLACE, type LessonPart, type SavedPlace } from "@/sky/lib/place";
import { orderDeck, resumeAt, runToKeep, sameSource, trimRun, type RunSource, type SavedRun } from "@/sky/lib/quiz-run";
import { seeded } from "@/sky/lib/random";
import { restLeft, restMinutes } from "@/sky/lib/rest";
import type { QuizConfig } from "@/types/sky";

import { loadQuiz } from "./actions";
import { grade } from "./grade";
import { runHref, skyHref } from "./hrefs";
import { typeKana } from "./typing";
import { retriesOf, retriesPatch } from "./retries";
import { SkyLoading, useSkyData } from "./local";
import { PitchMark } from "./pitch-reading";
import { keepLesson, keepRun, reportRun, usePlaceAtOpen } from "./quiz-run-store";
import { recordAnswers } from "./writes";

const TITLE = "Tonight's drill";

/** The break between two rounds, as the saved place writes it. */
type Pause = Extract<LessonPart, { kind: "break" }>;

export function QuizClient({ initial, picks, named, back, sample = false, signedIn, rounds = 1, accountPlace = NO_PLACE }: { initial: readonly QuizCard[] | null; picks: readonly string[]; named: readonly string[]; back: WayBack; sample?: boolean; signedIn: boolean; rounds?: number; accountPlace?: SavedPlace }) {
  const router = useRouter();
  // What this page was asked for, in the same words a run records. Nothing
  // named at all is "what is due", which is a source like any other, so a
  // second visit to a bare /quiz matches the run a bare /quiz left.
  const source = useMemo<RunSource>(() => ({ ...(picks.length ? { picks } : {}), ...(named.length ? { cards: named } : {}) }), [picks, named]);
  // The browser's copy first: it is here without a round trip. The account's
  // is what the route read on the server, and stands in when this browser has
  // none (a cleared browser, another machine). The sample records nothing and
  // so leaves nothing.
  const local = usePlaceAtOpen();
  const place = sample || !local ? NO_PLACE : hasPlace(local) ? local : accountPlace;
  // three rounds means this is a lesson's drill, so the sitting it belongs to
  // is what it picks up; one round means the quiz slot, as before
  const sitting = rounds > 1 ? lessonFor(place, picks) : null;
  const saved = rounds > 1 ? null : place.quiz;
  const [replaced, setReplaced] = useState(false);
  // a run of a different deck: only one quiz is kept, so it is asked about once
  const clash = saved && !sameSource(saved.from, source) ? saved : null;
  // The browser has not been asked yet, so which deck this page deals is not
  // known. The heading is, and it is drawn while the rest catches up
  // (SAK-356), rather than dealing one deck and swapping it for another.
  if (local === undefined) return <SkyLoading eyebrow="Quiz" title={TITLE} />;
  if (clash && !replaced) {
    return <ResumeAsk run={clash} href={runHref(clash.from)} title={TITLE} onStart={() => setReplaced(true)} onKeep={(href) => router.push(href)} />;
  }
  return <QuizDeck resume={clash ? null : saved} part={sitting?.part ?? null} source={source} initial={initial} picks={picks} named={named} back={back} sample={sample} signedIn={signedIn} rounds={rounds} router={router} />;
}

/** The deck this page asks: the saved run's, in the order it was dealt, or
 * the one the route dealt. */
function QuizDeck({ resume, part, source, initial, picks, named, back, sample, signedIn, rounds, router }: { resume: SavedRun | null; part: LessonPart | null; source: RunSource; initial: readonly QuizCard[] | null; picks: readonly string[]; named: readonly string[]; back: WayBack; sample: boolean; signedIn: boolean; rounds: number; router: ReturnType<typeof useRouter> }) {
  const { cfg, update } = useQuizConfig();
  // the clock, only ever read to decide whether a break the learner is coming
  // back to is still running
  const now = useNow(60_000);
  // The run to pick up: the quiz slot's for a quiz, and for a lesson's drill
  // the round the sitting was left in. A break holds no run, because the
  // round it leads into has not been dealt yet.
  const saved = resume ?? (part?.kind === "round" ? part.run : null);
  // The deck as ONE STRING, and the array made from it. The run is rewritten
  // after every answer, so the saved object is a new one each time; taking
  // the deck straight off it would give `load` a new identity per answer and
  // re-deal the cards underneath whoever is answering them.
  const deckKey = saved ? saved.deck.join("\n") : "";
  const deck = useMemo(() => (deckKey ? deckKey.split("\n") : null), [deckKey]);
  const load = useCallback((w: Parameters<typeof loadQuiz>[0]) => loadQuiz(w, deck ? { cards: deck } : { picks, cards: named, audio: cfg.audioPrompts, pitch: cfg.pitchQuestions }), [deck, picks, named, cfg.audioPrompts, cfg.pitchQuestions]);
  const { data: loaded, loading } = useSkyData({ sample, signedIn, load, initial: deck ? null : initial, eyebrow: "Quiz", title: TITLE });
  // A named deck is dealt afresh (SAK-388), which is right for a retry and
  // wrong for a resume: the cards go back into the order they were asked in.
  const cards = useMemo(() => (loaded && deck ? orderDeck(loaded, deck) : loaded), [loaded, deck]);
  // THE DECK IS DEALT ONCE, AND HOLDS FOR THE WHOLE SITTING (SAK-444).
  //
  // `useSkyData` loads again whenever the browser's copy of the history
  // changes, and signed out that copy changes the moment a round is recorded.
  // So the loader dealt a NEW order the instant round one ended: the results
  // screen was replaced by a freshly dealt round one about a quarter of a
  // second after it appeared, "Take a rest" could never be pressed, and a
  // lesson's rounds two and three were unreachable. What this page asks is
  // settled the first time it is known, the way a lesson's order is
  // (SAK-446). The ask is what the page was asked FOR, so a retry, which is
  // the same route with different cards named, deals again as it should.
  // Held as state set during the render that first sees the cards, which is
  // React's own way to adjust state when what a component was given changes:
  // it re-renders with the settled deck before anything is drawn, so no one
  // ever sees the second dealing.
  const ask = `${picks.join(",")}\n${named.join(",")}\n${deckKey}`;
  const [settled, setSettled] = useState<{ ask: string; cards: readonly QuizCard[] } | null>(null);
  if (cards && settled?.ask !== ask) setSettled({ ask, cards });
  const dealt = settled?.ask === ask ? settled.cards : null;
  // and the run itself is trimmed to the cards that actually came back, since
  // the library moves under a run left overnight
  const run = useMemo(() => (saved && dealt ? trimRun(saved, dealt.map((c) => c.id)) : null), [saved, dealt]);
  if (!dealt) return loading;
  // Where the sitting opens. A round opens on itself; a break opens on the
  // round after it, either resting on its clock or, once the clock is out,
  // straight into that round, which is what the offer promised. Only a break
  // waits on the clock, so every other quiz opens on its first render.
  if (part?.kind === "break" && now === null) return loading;
  const openRound = part?.kind === "round" ? part.round : part?.kind === "break" ? part.round + 1 : 1;
  const openBreak = part?.kind === "break" && restLeft(part.until, now ?? 0) > 0 ? part : null;
  return <QuizRun cards={dealt} run={run} openRound={openRound} openBreak={openBreak} lesson={rounds > 1} source={source} picks={picks} back={back} sample={sample} signedIn={signedIn} rounds={rounds} cfg={cfg} update={update} router={router} />;
}

function QuizRun({ cards, run, openRound, openBreak, lesson, source, picks, back, sample, signedIn, rounds, cfg, update, router }: { cards: readonly QuizCard[]; run: SavedRun | null; openRound: number; openBreak: Pause | null; lesson: boolean; source: RunSource; picks: readonly string[]; back: WayBack; sample: boolean; signedIn: boolean; rounds: number; cfg: QuizConfig; update: (patch: Partial<QuizConfig>) => void; router: ReturnType<typeof useRouter> }) {
  const onFinish = sample ? undefined : recordAnswers;
  const deck = cards.map((c) => c.id).join("\n");
  // Where the sitting stands on this page: which round, the break it is in or
  // has just earned, and whether the break is what is showing. A break is
  // written down the moment a round ends rather than when the button is
  // pressed, so a learner who closes the tab on the results is between rounds
  // and the offer says so; `resting` is what the button turns on.
  const [round, setRound] = useState(openRound);
  const [pause, setPause] = useState<Pause | null>(openBreak);
  const [resting, setResting] = useState(!!openBreak);
  // Every round asks its own order (SAK-388). The first keeps the one the
  // deck came in, which is the order the server rendered, so hydration has
  // nothing to disagree with; the rounds after it deal again, or the second
  // and third are answered from the rhythm of the first. Seeded, not
  // Math.random: a re-render mid-round must not move the card underneath
  // whoever is answering it. A round PICKED UP keeps the order it was dealt
  // in, which is the order the saved run holds and `orderDeck` put the cards
  // back into.
  const [seed] = useState(() => (Math.floor(Math.random() * 0x7fffffff) || 1));
  const picked = !!run && round === openRound;
  const asked = useMemo(() => (picked || round <= 1 ? cards : shuffleDeck(cards, seeded(seed + round))), [picked, cards, round, seed]);
  const ids = useMemo(() => asked.map((c) => c.id), [asked]);

  // a retry is the same route with just those cards named
  const retry = (going: readonly string[]) => router.push(skyHref("/quiz", { sample, cards: going }));
  const finish = async (answers: readonly QuizAnswer[]) => {
    if (round < rounds) {
      const startedAt = Date.now();
      const part: Pause = { kind: "break", round, startedAt, until: startedAt + restMinutes(round + 1, cfg.restFirstMin, cfg.restThenMin) * 60_000 };
      setPause(part);
      if (!sample && lesson) keepLesson(lessonAt(picks, part, startedAt), signedIn);
    } else if (!sample) {
      // the last round is over the moment the answers go to the recorder:
      // nothing to come back to, so nothing kept (SAK-404, SAK-444)
      if (lesson) keepLesson(null, signedIn);
      else keepRun(null, signedIn);
    }
    if (onFinish) await onFinish(answers);
  };
  // Where the round stands, said when the screen mounts and after every answer
  // (`SkyQuiz`'s `onProgress`). The sample keeps nothing at all, the way it
  // records nothing.
  //
  // A LESSON'S ROUND IS KEPT FROM THE MOMENT IT OPENS, before a single card is
  // answered, because a learner who opens the drill and walks away is in the
  // middle of a sitting and the button has to say so. The quiz slot is
  // deliberately NOT kept that way (see `reportRun`): a quiz page can arrive
  // on top of a run from somewhere else, and writing an empty deck over it
  // would throw away a quiz the learner had not decided to replace. The lesson
  // slot is this lesson's own, so nothing else can be in it.
  const progress = (at: number, answers: readonly QuizAnswer[]) => {
    if (sample) return;
    const now = Date.now();
    if (lesson) keepLesson(lessonAt(picks, { kind: "round", round, run: { deck: ids, at, answers, from: source, leftAt: now } }, now), signedIn);
    else reportRun(runToKeep(ids, at, answers, source, now), signedIn);
  };
  const takeRest = () => setResting(true);
  const startNext = () => {
    setRound((pause?.round ?? round) + 1);
    setPause(null);
    setResting(false);
  };
  // the break length is changed on the break screen itself: it is the setting
  // (the first break, or every one after), and this break re-counts from its start
  const setMinutes = (n: number) => {
    if (!pause) return;
    update(pause.round + 1 <= 2 ? { restFirstMin: n } : { restThenMin: n });
    const part: Pause = { ...pause, until: pause.startedAt + n * 60_000 };
    setPause(part);
    if (!sample && lesson) keepLesson(lessonAt(picks, part, Date.now()), signedIn);
  };

  if (resting && pause) return <SkyRest until={pause.until} nextRound={pause.round + 1} rounds={rounds} onStart={startNext} minutes={restMinutes(pause.round + 1, cfg.restFirstMin, cfg.restThenMin)} onMinutes={setMinutes} back={back} />;
  const next = round < rounds ? { label: `Take a rest, then round ${round + 1} of ${rounds}`, onClick: takeRest } : undefined;
  // keyed by its cards and round, so a retry or the next round starts fresh
  return <SkyQuiz key={`${deck}\n${round}`} cards={asked} grade={grade} toKana={typeKana} hear={HearButton} pitch={PitchMark} results={{ back, onFinish: finish, onRetry: retry, next }} run={{ at: picked && run ? resumeAt(run) : 0, answers: picked ? run?.answers : undefined, onProgress: (state) => progress(state.at, state.answers) }} settings={{ retries: retriesOf(cfg), onRetries: (n) => update(retriesPatch(n)), timerSeconds: cfg.timer ? cfg.timerSec : 0 }} />;
}
