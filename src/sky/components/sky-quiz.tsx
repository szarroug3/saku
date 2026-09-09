"use client";

// The Quiz: the quiet room. Tracked as SAK-312 to SAK-317.
//
// The sky is dense and full of things to look at; the Quiz is the opposite
// on purpose: one prompt, centred, nothing in the corners. The box keeps
// one size whatever the card shows, so the arrows never move; a missed
// card's lesson opens under it.
//
// One call from the route, given the cards and a grader. A strip of pips
// along the top, one per card, coloured by outcome; each is a button, so a
// card can be skipped and come back to (Sam, 2026-09-05). Every card
// opens on a blank box. A right answer moves straight on. A wrong one gets
// another try, the retries set on the bar plus one in all, before the card is missed and its answer
// shown with the lesson's own card. Help is a small row of buttons:
// multiple choice, a hint, giving up. At the end, this screen hands over to
// the results (quiz-results.tsx), which counts the run and records it.
//
// Four files, not one (SAK-420). This one is the loop: the tries, the grading,
// the keys, the way on. `quiz-results.tsx` is the room the run is looked back
// on, and it owns the recording. `lib/quiz-pass.ts` is where the pass over the
// deck has got to, pure and tested, which this screen holds in one piece of
// state. `quiz-board.tsx` draws the prompt and the boards a card is answered
// on, and holds nothing.

import { useEffect, useRef, useState, type FormEvent } from "react";

import { LessonCard, type HearComponent, type PitchComponent } from "@/sky/components/lesson-card";
import { QuizChoices, QuizOrder, QuizPrompt } from "@/sky/components/quiz-board";
import { QuizQuestions } from "@/sky/components/quiz-questions";
import { QuizHint, QuizRuleBlock, QuizVerdict, QuizWhy } from "@/sky/components/quiz-verdict";
import { RoundButton, SkyButton } from "@/sky/components/sky-button";
import { QuizResults, type QuizEnding } from "@/sky/components/quiz-results";
import { useNarrow } from "@/sky/components/use-narrow";
import { SkyInput } from "@/sky/components/sky-input";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyStepper } from "@/sky/components/sky-stepper";
import { SkyPageBody } from "@/sky/components/sky-page-body";
import { DEFAULT_RETRIES, FRESH, gradeFor, maxTriesFor, triesNote, type Grade, type Open, type QuizAnswer, type QuizCard } from "@/sky/lib/quiz";
import { allAnswered, answeredCount, finishPass, nextOpen, openPass, passAnswers, stepTo, withAnswer, type QuizPass } from "@/sky/lib/quiz-pass";

interface SkyQuizProps {
  cards: readonly QuizCard[];
  /** Whether what was typed answers the card. */
  grade: (card: QuizCard, given: string) => boolean;
  /** Romaji as kana, for a card whose answer is Japanese (`answerInKana`).
   * Handed in like the grader: the transliterator is the app's. */
  toKana?: (value: string, katakana: boolean) => string;
  hear?: HearComponent;
  pitch?: PitchComponent;
  /** What the end of this deck offers, and where its answers go, in one piece
   * (SAK-420): the way back, the recorder, the retry, practice's naming, the
   * round after this one. Handed straight to the results screen, which owns
   * every one of them. The empty deck's one button is the way back out of it,
   * which is this way back: there is nothing else to do on that screen. */
  results: QuizEnding;
  /** The quiz's own two settings, and the clock. Retries after a first wrong
   * answer are changed on the help bar rather than on the Settings page (Sam,
   * 2026-09-06: the one home for a setting is where you would change it);
   * `timerSeconds` is how long a card gets before it counts as missed, and
   * none when unset. */
  settings?: {
    retries?: number;
    onRetries?: (retries: number) => void;
    timerSeconds?: number;
  };
  /** The run this screen is a pass over (SAK-404), in one piece: where it was
   * left, what was answered there, and where to say it stands now.
   *
   * `at` and `answers` are read ONCE, when the screen mounts: the quiz owns
   * its state from then on, and the caller writing the run down after every
   * answer must not push it back in.
   *
   * `onProgress` is called after every answer and every step through the deck,
   * for whoever writes the run down, and never once the quiz is finished:
   * there is nothing left to come back to then, and clearing what was written
   * is the caller's own business, next to recording the answers. The Sky does
   * not know where a run goes; the route does. */
  run?: {
    at?: number;
    answers?: readonly QuizAnswer[];
    onProgress?: (state: { at: number; answers: readonly QuizAnswer[] }) => void;
  };
  /** What this quiz is of, as the page's title. The eyebrow is always
   * "Quiz"; the title says what is in front of you (SAK-357), which is
   * tonight's drill off a lesson and the deck off a practice recipe. */
  title?: string;
  height?: string;
}

export function SkyQuiz({ cards, grade, toKana, hear, pitch, results, settings, run, title = "Tonight's drill", height }: SkyQuizProps) {
  const { retries = DEFAULT_RETRIES, onRetries, timerSeconds = 0 } = settings ?? {};

  // The pass over this deck, in one object: where it is, what has been
  // answered, whether it is over (SAK-420, and quiz-pass.ts for the moves).
  // Opened ONCE, on nothing or on where a saved run was left; the quiz owns it
  // from then on, and the caller writing the run down after every answer must
  // not push it back in.
  const [pass, setPass] = useState<QuizPass>(() => openPass(run));
  const { at, answers, finished } = pass;
  const [open, setOpen] = useState<Readonly<Record<string, Open>>>({});
  const [given, setGiven] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // the timer's clock: read every quarter second while a timed card is
  // open, and when each card was first shown (set on the tick, so the
  // render never reads the clock itself)
  const [clock, setClock] = useState<{ now: number; shownAt: Readonly<Record<string, number>> }>({ now: 0, shownAt: {} });
  // a listening card plays itself when it appears
  const listenRef = useRef<HTMLSpanElement>(null);

  const card = cards[at];
  const state = card ? (open[card.id] ?? FRESH) : FRESH;
  const answered = card ? answers[card.id] : undefined;
  // the choices show when asked for, or on a card only ever asked that way
  const choices = card ? (state.narrowed || !card.typed) : false;
  // listening: the glyph stays hidden until the card is answered or a hint asked
  const listening = !!card?.listen && !answered && !state.hinted;
  const cardId = card?.id;
  // the timeout fires from the tick, through a ref that always holds the
  // latest handler, so the effect itself sets nothing
  const onTimeOut = useRef<() => void>(() => {});
  useEffect(() => {
    if (!cardId || answered || !timerSeconds) return;
    const tick = () => setClock((c) => {
      const shownAt = c.shownAt[cardId] ?? Date.now();
      if (shownAt + timerSeconds * 1000 <= Date.now()) setTimeout(() => onTimeOut.current(), 0);
      return { now: Date.now(), shownAt: c.shownAt[cardId] ? c.shownAt : { ...c.shownAt, [cardId]: shownAt } };
    });
    const t = setInterval(tick, 100);
    tick();
    return () => clearInterval(t);
  }, [cardId, answered, timerSeconds]);
  useEffect(() => {
    if (!listening) return;
    const t = setTimeout(() => listenRef.current?.querySelector("button")?.click(), 50);
    return () => clearTimeout(t);
  }, [listening, cardId]);
  const timeLeft = timerSeconds && cardId && clock.shownAt[cardId] ? Math.max(0, clock.shownAt[cardId] + timerSeconds * 1000 - clock.now) : null;

  const maxTries = maxTriesFor(card, retries);

  // the box takes focus for every card that is still open
  useEffect(() => { if (!answered) input.current?.focus(); }, [at, answered]);

  // Where the run has got to, out to whoever writes it down (SAK-404).
  //
  // An effect on the state itself rather than a call inside `settle`, because
  // the position a resume should open on is where the quiz ended up AFTER the
  // answer settled it, and that is one render later. It fires on a step
  // through the deck too, which is right: the card you were looking at is
  // part of where you left off. Through a ref, the way `onTimeOut` does it,
  // so a caller who passes a fresh closure every render does not resubscribe.
  //
  // Never once the quiz is finished: the run is over, and the route clears it
  // as the answers go to the recorder.
  const report = useRef(run?.onProgress);
  useEffect(() => { report.current = run?.onProgress; });
  useEffect(() => {
    if (pass.finished) return;
    report.current?.({ at: pass.at, answers: passAnswers(pass, cards) });
  }, [pass, cards]);

  const patch = (change: Partial<Open>) => setOpen({ ...open, [card.id]: { ...state, ...change } });

  /** Moves to the next open card, wrapping; finishes when every card is
   * answered. Takes the pass to move ON from, which for an answer that has
   * just settled is the one that settled it, not the one on screen. */
  const advance = (from: QuizPass) => {
    setGiven(""); setFeedback(null);
    setPass(nextOpen(from, cards));
  };

  /** Done with the deck, whatever is left in it. Where the answers go from
   * here is the results screen's own business (SAK-420). */
  const finish = (from: QuizPass) => setPass(finishPass(from));

  /** The card's answer written into the pass, its position unmoved: a miss
   * stays on its own reveal, and a right answer is moved on separately. */
  const settle = (g: Grade, tries: number, extra: Partial<QuizAnswer> = {}): QuizPass => {
    const answer: QuizAnswer = { cardId: card.id, grade: g, tries: Math.max(1, tries), narrowed: state.narrowed, hinted: state.hinted, ...(state.said.length ? { said: state.said } : {}), ...(card.meta ? { meta: card.meta } : {}), ...extra };
    return withAnswer(pass, answer);
  };

  /** One go at the card, whichever way it was answered.
   *
   * Typing, picking and placing differ only in what they compare, what they
   * record as said and what a wrong go leaves behind; the rule about tries
   * is the same for all three and lives here once. A right answer settles
   * and moves on; a wrong one at the last try is a miss with the answer
   * shown; otherwise the card keeps its place and says how many tries are
   * left. What comes back says which of the three happened, so a caller
   * with more to do on a wrong go (the box empties itself) can.
   *
   * A card that opens on its choices is answered cold: help is only what was
   * asked for (the choices on a typed card, a hint) or a retry. An ordering
   * card is never `typed`, so "Multiple choice" is never offered on it and
   * `narrowed` cannot be true there.
   */
  const attempt = ({ right, said, note, wrong }: { right: boolean; said?: string; note: string; wrong?: Partial<Open> }): "right" | "missed" | "again" => {
    const tries = state.tries + 1;
    const tried = said === undefined ? state.said : [...state.said, said];
    if (right) { advance(settle(gradeFor(tries > 1 || state.narrowed || state.hinted), tries, { said: tried })); return "right"; }
    if (tries >= maxTries) { setPass(settle("missed", tries, { said: tried })); setFeedback(null); return "missed"; }
    patch({ tries, said: tried, ...wrong });
    setFeedback(`${note} ${triesNote(maxTries - tries)}`);
    return "again";
  };

  /** A right answer moves straight on; a wrong one costs a try. Typed text
   * is graded when there is any; else the picked choice. */
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = given.trim();
    if (answered) return;
    if (!text) { if (state.chosen) choose(state.chosen); return; }
    if (attempt({ right: grade(card, text), said: text, note: "Not that." }) === "again") setGiven("");
  };

  const choose = (id: string) => {
    if (answered || state.wrong.includes(id)) return;
    attempt({
      right: id === card.answerId,
      said: card.options.find((o) => o.id === id)?.label,
      note: "Not that one.",
      wrong: { wrong: [...state.wrong, id], chosen: undefined },
    });
  };

  /** Checks an ordering card's pieces as placed; a wrong order clears them. */
  const submitOrder = () => {
    if (answered || !card.order) return;
    const built = state.built ?? [];
    if (built.length !== card.order.pieces.length) return;
    attempt({
      right: built.every((p, i) => card.order!.pieces[p] === card.order!.answer[i]),
      said: built.map((p) => card.order!.pieces[p]).join(" "),
      note: "Not that order.",
      wrong: { built: [] },
    });
  };

  /** Picks a choice without checking it; a pitched choice plays its clip. */
  const hears = useRef(new Map<string, HTMLSpanElement>());
  const pick = (id: string) => {
    if (answered || state.wrong.includes(id)) return;
    patch({ chosen: id });
    hears.current.get(id)?.querySelector("button")?.click();
  };

  /** Time ran out: a miss, and the answer shown. */
  const timeOut = () => { if (card && !answered) setPass(settle("missed", state.tries + 1)); };
  useEffect(() => { onTimeOut.current = timeOut; });

  // Giving up adds nothing to the list. Whatever was tried before it still
  // stands, and "I don't know" is not something you said (SAK-387).
  const giveUp = () => { if (!answered) { setPass(settle("missed", state.tries + 1)); setFeedback(null); } };

  const go = (n: number) => { if (n >= 0 && n < cards.length) { setPass(stepTo(pass, cards, n)); setGiven(""); setFeedback(null); } };

  // Enter answers the card and then moves on from its reveal; the arrow keys
  // step through the cards when the box is empty.
  //
  // A TYPED card answers itself: its box is in a form, and Enter there is a
  // submit. A card with no box has no form, so its Enter never reached
  // anything and the learner had to go and click Check (Sam, 2026-09-06).
  // The window takes that key instead, but only when it did NOT come from
  // the box, so a typed card is still answered by its own form exactly once.
  // Enter on a choice not yet picked falls through to the button, which
  // picks it; a second Enter then checks it, which is the same two steps the
  // mouse takes and the reason a pitch clip can be heard before committing.
  //
  // One subscription, through a ref that holds the latest handler, the way
  // `onTimeOut` above does it. The effect used to have no dependency list, so
  // it took the window listener off and put it back on every render, which on
  // a timed card is ten times a second (SAK-370).
  const pressed = (e: KeyboardEvent) => {
    if (finished || !card) return;
    if (e.key === "Enter" && answered) { e.preventDefault(); if (allAnswered(pass, cards)) finish(pass); else advance(pass); }
    if (e.key === "Enter" && !answered && e.target !== input.current) {
      if (card.order) { if ((state.built ?? []).length === card.order.pieces.length) { e.preventDefault(); submitOrder(); } }
      else if (state.chosen) { e.preventDefault(); submit(); }
    }
    if (e.key === "ArrowLeft" && !given) go(at - 1);
    if (e.key === "ArrowRight" && !given) go(at + 1);
  };
  const onKey = useRef(pressed);
  useEffect(() => { onKey.current = pressed; });
  useEffect(() => {
    const key = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // The deck used to be a strip of pips here. It is a foldable list down
  // the right now (SAK-384). Its width is held open on either side of the
  // card at all times, so the card sits in the middle of the page whether
  // the list is there or not: opening it must neither move the card (Sam,
  // 2026-09-06) nor cover it. Below `lg` there is no room for both, so the
  // list takes the card's place instead.
  const narrow = useNarrow(1023);
  const [asked, setAsked] = useState<boolean | null>(null);
  const listOpen = asked ?? !narrow;
  const cardShown = !(narrow && listOpen);
  const strip = (
    <div className="flex flex-wrap items-center gap-3 font-sky-ui text-[12.5px] text-sky-muted">
      <span className="whitespace-nowrap tabular-nums">{finished ? `${answeredCount(pass)} of ${cards.length}` : `${at + 1} of ${cards.length}`}</span>
      {!finished && cards.length > 0 && !listOpen && <SkyButton variant="outline" onClick={() => setAsked(true)}>The cards</SkyButton>}
      {!finished && cards.length > 0 && <SkyButton variant="outline" onClick={() => finish(pass)}>End the quiz</SkyButton>}
    </div>
  );

  if (cards.length === 0) {
    return (
      <SkyPageShell eyebrow="Quiz" title="Nothing to quiz" height={height}>
        <SkySurface className="mx-auto max-w-[560px]">
          <p className="text-[14px] text-sky-muted">Nothing is due. Learn something in the Observatory, drill whatever you like in Practice, or pick things in the Atlas and ask for a quiz.</p>
          <SkyButton href={results.back.href} className="mt-4">{results.back.label}</SkyButton>
        </SkySurface>
      </SkyPageShell>
    );
  }

  if (finished) {
    return <QuizResults cards={cards} answers={answers} ending={results} pitch={pitch} height={height} />;
  }

  const triesLeft = maxTries - state.tries;
  const help = [
    !answered && card.typed && !state.narrowed && card.options.length > 1 ? { label: "Multiple choice", run: () => patch({ narrowed: true }) } : null,
    // a listening card's hint is the writing itself
    !answered && (card.hint || card.listen) && !state.hinted ? { label: card.listen ? "Show it" : "Hint", run: () => patch({ hinted: true }) } : null,
    !answered ? { label: "I don't know", run: giveUp } : null,
  ].filter((h): h is { label: string; run: () => void } => !!h);

  return (
    <SkyPageShell eyebrow="Quiz" title={title} aside={strip} height={height}>
    {/* The list slides in beside the card, and the card slides with it: it
        is centred in whatever space is left, never held still and never
        squeezed (Sam, 2026-09-06, SAK-396). The room for the list is the
        padding on this box, which is the only thing that moves the card,
        so the two animate together; an absolutely positioned child sits
        against the padding box, so the list itself does not move with it.

        `overflow-clip`, NOT `hidden`: a hidden box is still a scroll port,
        so the parked list hanging off the right edge made this scrollable,
        and the browser scrolled it there and eased back, carrying the card
        with it. Clip crops the same and can never be scrolled. */}
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-clip transition-[padding] duration-200 ease-out motion-reduce:transition-none ${listOpen ? "lg:pr-60" : ""}`}>
      {/* one width for the box whatever is on the card, so the arrows stay
          put while stepping back and forth; the help is a bar down its right
          side, so the box may grow downward for the choices without anything
          above moving (Sam, 2026-09-05); no arrow past either end. A hint,
          and a missed card's lesson, open in the panel underneath. */}
      {cardShown && <SkyPageBody width="reading">
        <SkySurface className="flex shrink-0 flex-col">
          <div className="flex items-center justify-between gap-3">
            <span className={at === 0 ? "invisible" : ""}><RoundButton label="Back a card" onClick={() => go(at - 1)}>‹</RoundButton></span>
            <span className={at === cards.length - 1 ? "invisible" : ""}><RoundButton label="Skip to the next card" onClick={() => go(at + 1)}>›</RoundButton></span>
          </div>
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
            {/* min-w-0: a flex item will not shrink below its content's own
                minimum without it, so a narrow card pushed the help bar off
                the right edge and the clip above swallowed it (SAK-396) */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <QuizPrompt card={card} listening={listening} answered={!!answered} listenRef={listenRef} hear={hear} />

              {!answered && (
                <div className="mt-4 flex flex-col gap-3">
                  {feedback && <p className="text-center text-[13px] text-sky-slipping">{feedback}</p>}
                  {card.typed && (
                    <form onSubmit={submit} className="flex gap-2">
                      <SkyInput
                        ref={input}
                        value={given}
                        onChange={(e) => setGiven(card.answerInKana && toKana ? toKana(e.target.value, card.answerInKana === "katakana") : e.target.value)}
                        placeholder={card.answerIs === "reading" ? (card.answerInKana ? "The reading" : "The reading, in romaji") : card.answerIs === "meaning" ? "The meaning, in English" : "Your answer"}
                        className="min-w-0 flex-1"
                      />
                      <SkyButton onClick={() => submit()} disabled={!given.trim() && !state.chosen}>Check</SkyButton>
                    </form>
                  )}
                  {card.order && <QuizOrder order={card.order} built={state.built ?? []} onBuilt={(built) => patch({ built })} onCheck={submitOrder} />}
                  {choices && !card.order && <QuizChoices card={card} state={state} onPick={pick} hear={hear} pitch={pitch} hears={hears} />}
                  {/* a card without a box still checks its pick with a button.
                      Never an ordering card: `choices` is true for anything not
                      typed, and that one has its own Check under its pieces. */}
                  {choices && !card.typed && !card.order && (
                    <div className="flex justify-center"><SkyButton onClick={() => submit()} disabled={!state.chosen}>Check</SkyButton></div>
                  )}
                </div>
              )}

              {answered && <QuizVerdict answered={answered} answer={card.answer} answerPitch={card.answerPitch} pitch={pitch} />}
              {/* which reading applies, and why: the rule, not the answer
                  again (SAK-316) */}
              {answered && card.rule && <QuizRuleBlock rule={card.rule} />}
              {/* why the others were there, but only when they were: naming
                  choices that were never on screen is noise (SAK-315) */}
              {answered && (!card.typed || answered.narrowed) && <QuizWhy card={card} pitch={pitch} />}
            </div>

            {/* the bar: help while the card is open, the way on once it is done */}
            <div className="flex shrink-0 flex-col gap-2 border-t border-sky-line pt-3 md:w-[168px] md:border-t-0 md:border-l md:pl-4 md:pt-0">
              {/* The eyebrow used to carry three facts in small caps, "HELP ME
                  · 2 TRIES LEFT · 8S" (SAK-365). It is the bar's name again;
                  the tries are their own line, in the words the feedback
                  already uses, and the seconds sit beside the bar they count. */}
              <Eyebrow tight>{answered ? "Move on" : "Help me"}</Eyebrow>
              {!answered && state.tries > 0 && <p className="text-[12px] text-sky-muted">{triesNote(triesLeft)}</p>}
              {timeLeft !== null && timerSeconds > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-sky-line" aria-hidden>
                    <div className={`h-full transition-[width] duration-100 ease-linear ${timeLeft < 3000 ? "bg-sky-slipping" : "bg-sky-accent"}`} style={{ width: `${(timeLeft / (timerSeconds * 1000)) * 100}%` }} />
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-sky-muted">{Math.ceil(timeLeft / 1000)}s</span>
                </div>
              )}
              {answered
                ? <SkyButton block onClick={() => allAnswered(pass, cards) ? finish(pass) : advance(pass)}>{allAnswered(pass, cards) ? "Finish" : "Next"}</SkyButton>
                : help.map((h) => <SkyButton key={h.label} variant="outline" block onClick={h.run}>{h.label}</SkyButton>)}
              {onRetries && !answered && (
                <div className="mt-auto pt-3">
                  <Eyebrow>Retries</Eyebrow>
                  <SkyStepper value={retries} onChange={onRetries} label="Retries after a wrong answer" min={0} max={9} />
                </div>
              )}
            </div>
          </div>
        </SkySurface>

        {!answered && state.hinted && card.hint && <QuizHint hint={card.hint} />}

        {answered && (
          // The lesson scrolls inside itself rather than taking the card with
          // it (SAK-392). One scroller for the whole column meant reading a
          // long grammar page carried the card, the verdict, the answer and
          // Next off the top, and the only way back to what you got wrong was
          // to scroll up. It takes whatever the card leaves and scrolls within
          // that, with a floor so it is never squeezed to nothing; past the
          // floor the column scrolls as a whole, which is the safety valve for
          // a screen too short to hold the card at all.
          <LessonCard item={card.item} teach={card.teach} madeOf={[]} partOf={[]} onSelect={() => undefined} hear={hear} pitch={pitch} className="min-h-[120px] flex-1 overflow-y-auto" />
        )}
      </SkyPageBody>}

      <QuizQuestions
        cards={cards}
        answers={answers}
        at={at}
        open={listOpen}
        onGo={(n) => { go(n); if (narrow) setAsked(false); }}
        onClose={() => setAsked(false)}
      />
    </div>
    </SkyPageShell>
  );
}
