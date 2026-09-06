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
// multiple choice, a hint, giving up. At the end, the three counts and
// what each does to the schedule, then the answers go to whoever records
// them.

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";

import { LessonCard, type HearComponent, type PitchComponent } from "@/sky/components/lesson-card";
import { QuizQuestions } from "@/sky/components/quiz-questions";
import { RoundButton, SkyButton } from "@/sky/components/sky-button";
import { QuizResults, VERDICT } from "@/sky/components/quiz-results";
import { useNarrow } from "@/sky/components/use-narrow";
import { SkyInput } from "@/sky/components/sky-input";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { Eyebrow } from "@/sky/components/sky-card";
import { japaneseFont, optionSize, promptSize } from "@/sky/lib/japanese";
import { SkyStepper } from "@/sky/components/sky-stepper";
import { DEFAULT_RETRIES, GRADE, gradeFor, type Grade, type QuizAnswer, type QuizCard } from "@/sky/lib/quiz";

export interface SkyQuizProps {
  cards: readonly QuizCard[];
  /** Whether what was typed answers the card. */
  grade: (card: QuizCard, given: string) => boolean;
  /** Romaji as kana, for a card whose answer is Japanese (`answerInKana`).
   * Handed in like the grader: the transliterator is the app's. */
  toKana?: (value: string, katakana: boolean) => string;
  /** Where the answers go when the session ends: the schedule. */
  onFinish?: (answers: readonly QuizAnswer[]) => Promise<void>;
  /** Back to the observatory. */
  skyHref: string;
  hear?: HearComponent;
  pitch?: PitchComponent;
  /** Starts a new quiz of just these cards, from the results. */
  onRetry?: (cardIds: readonly string[]) => void;
  /** Practice's offer to keep the recipe, on the results. */
  onSave?: (name: string) => void;
  /** The recipe names already taken, for the results' naming box. */
  savedNames?: readonly string[];
  /** The round after this one, on the results (a lesson's quiz). */
  next?: { label: string; onClick: () => void };
  /** Retries after a first wrong answer, and the way to change it here:
   * the setting lives in the help bar, not on the Settings page. */
  retries?: number;
  onRetries?: (retries: number) => void;
  /** Seconds a card gets before it counts as missed; none when unset. */
  timerSeconds?: number;
  height?: string;
}

/** A context line that only names the kind of answer ("meaning") says
 * nothing the instruction does not; a frame or a gloss is worth showing. */
const LABEL_ONLY = /^(meaning|reading|in japanese)$/i;

/** Where a card stands while it is still open: what has been tried and
 * what help was taken. Kept per card, so a skipped card resumes. */
interface Open {
  tries: number;
  narrowed: boolean;
  hinted: boolean;
  /** Choices already tried and found wrong. */
  wrong: readonly string[];
  /** Everything tried on this card so far, in order, for the reveal to list
   * (SAK-387). Each attempt is added as it is made, so an earlier guess is
   * still there when a later one settles the card. */
  said: readonly string[];
  /** The choice picked and not yet checked (a pick only selects; Check
   * submits, so a clip can be heard first: Sam, 2026-09-05). */
  chosen?: string;
  /** An ordering card's pieces placed so far, by their index in the deal. */
  built?: readonly number[];
}

const FRESH: Open = { tries: 0, narrowed: false, hinted: false, wrong: [], said: [] };

/** "One more try." or "2 tries left." */
const triesNote = (left: number) => (left === 1 ? "One more try." : `${left} tries left.`);

export function SkyQuiz({ cards, grade, toKana, onFinish, skyHref, hear, pitch, onRetry, onSave, savedNames, next, retries = DEFAULT_RETRIES, onRetries, timerSeconds = 0, height }: SkyQuizProps) {
  const Pitch = pitch;
  const Hear = hear;

  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Readonly<Record<string, QuizAnswer>>>({});
  const [open, setOpen] = useState<Readonly<Record<string, Open>>>({});
  const [given, setGiven] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState<"no" | "saving" | "yes" | "failed">("no");
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
  const answeredCount = Object.keys(answers).length;
  const allAnswered = cards.length > 0 && answeredCount === cards.length;
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

  // a card of two choices is wrong after one wrong pick; a typed card, or a
  // fuller board, gets the retries
  // tries in all: the retries plus the first go, and never more than a
  // board of choices can honestly offer
  const maxTries = card ? (card.typed || card.order ? retries + 1 : Math.min(retries + 1, Math.max(1, card.options.length - 1))) : retries + 1;

  // the box takes focus for every card that is still open
  useEffect(() => { if (!answered) input.current?.focus(); }, [at, answered]);

  const patch = (change: Partial<Open>) => setOpen({ ...open, [card.id]: { ...state, ...change } });

  /** Moves to the next open card after `from`, wrapping; finishes when
   * every card is answered. */
  const advance = (from: number, all: Readonly<Record<string, QuizAnswer>>) => {
    setGiven(""); setFeedback(null);
    if (Object.keys(all).length >= cards.length) { finish(all); return; }
    for (let step = 1; step <= cards.length; step++) {
      const n = (from + step) % cards.length;
      if (!all[cards[n].id]) { setAt(n); return; }
    }
  };

  const finish = (all: Readonly<Record<string, QuizAnswer>>) => {
    setFinished(true);
    if (!onFinish) return;
    setSaved("saving");
    onFinish(cards.map((c) => all[c.id]).filter((a): a is QuizAnswer => !!a)).then(() => setSaved("yes"), () => setSaved("failed"));
  };

  const settle = (g: Grade, tries: number, extra: Partial<QuizAnswer> = {}) => {
    const answer: QuizAnswer = { cardId: card.id, grade: g, tries: Math.max(1, tries), narrowed: state.narrowed, hinted: state.hinted, ...(state.said.length ? { said: state.said } : {}), ...(card.meta ? { meta: card.meta } : {}), ...extra };
    const all = { ...answers, [card.id]: answer };
    setAnswers(all);
    return all;
  };

  /** A right answer moves straight on; a wrong one costs a try. Typed text
   * is graded when there is any; else the picked choice. */
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = given.trim();
    if (answered) return;
    if (!text) { if (state.chosen) choose(state.chosen); return; }
    const tries = state.tries + 1;
    const said = [...state.said, text];
    if (grade(card, text)) {
      const all = settle(gradeFor(tries > 1 || state.narrowed || state.hinted), tries, { said });
      advance(at, all);
      return;
    }
    if (tries >= maxTries) { settle("missed", tries, { said }); setFeedback(null); return; }
    patch({ tries, said });
    setGiven("");
    setFeedback(`Not that. ${triesNote(maxTries - tries)}`);
  };

  const choose = (id: string) => {
    if (answered || state.wrong.includes(id)) return;
    const tries = state.tries + 1;
    // a card that opens on its choices is answered cold: help is only what
    // was asked for (the choices on a typed card, a hint) or a retry
    const label = card.options.find((o) => o.id === id)?.label;
    const said = label ? [...state.said, label] : state.said;
    if (id === card.answerId) { const all = settle(gradeFor(tries > 1 || state.narrowed || state.hinted), tries, { said }); advance(at, all); return; }
    if (tries >= maxTries) { settle("missed", tries, { said }); setFeedback(null); return; }
    patch({ tries, wrong: [...state.wrong, id], chosen: undefined, said });
    setFeedback(`Not that one. ${triesNote(maxTries - tries)}`);
  };

  /** Checks an ordering card's pieces as placed; a wrong order clears them. */
  const submitOrder = () => {
    if (answered || !card.order) return;
    const built = state.built ?? [];
    if (built.length !== card.order.pieces.length) return;
    const tries = state.tries + 1;
    const right = built.every((p, i) => card.order!.pieces[p] === card.order!.answer[i]);
    const said = [...state.said, built.map((p) => card.order!.pieces[p]).join(" ")];
    if (right) { const all = settle(gradeFor(tries > 1 || state.hinted), tries, { said }); advance(at, all); return; }
    if (tries >= maxTries) { settle("missed", tries, { said }); setFeedback(null); return; }
    patch({ tries, built: [], said });
    setFeedback(`Not that order. ${triesNote(maxTries - tries)}`);
  };

  /** Picks a choice without checking it; a pitched choice plays its clip. */
  const hears = useRef(new Map<string, HTMLSpanElement>());
  const pick = (id: string) => {
    if (answered || state.wrong.includes(id)) return;
    patch({ chosen: id });
    hears.current.get(id)?.querySelector("button")?.click();
  };

  /** Time ran out: a miss, and the answer shown. */
  const timeOut = () => { if (card && !answered) settle("missed", state.tries + 1); };
  useEffect(() => { onTimeOut.current = timeOut; });

  // Giving up adds nothing to the list. Whatever was tried before it still
  // stands, and "I don't know" is not something you said (SAK-387).
  const giveUp = () => { if (!answered) { settle("missed", state.tries + 1); setFeedback(null); } };

  const go = (n: number) => { if (n >= 0 && n < cards.length) { setAt(n); setGiven(""); setFeedback(null); } };

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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.key === "Enter" && answered) { e.preventDefault(); if (allAnswered) finish(answers); else advance(at, answers); }
      if (e.key === "Enter" && !answered && e.target !== input.current) {
        if (card.order) { if ((state.built ?? []).length === card.order.pieces.length) { e.preventDefault(); submitOrder(); } }
        else if (state.chosen) { e.preventDefault(); submit(); }
      }
      if (e.key === "ArrowLeft" && !given) go(at - 1);
      if (e.key === "ArrowRight" && !given) go(at + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
      <span className="whitespace-nowrap tabular-nums">{finished ? `${answeredCount} of ${cards.length}` : `${at + 1} of ${cards.length}`}</span>
      {!finished && cards.length > 0 && !listOpen && <SkyButton variant="outline" onClick={() => setAsked(true)}>The cards</SkyButton>}
      {!finished && cards.length > 0 && <SkyButton variant="outline" onClick={() => finish(answers)}>End the quiz</SkyButton>}
    </div>
  );

  if (cards.length === 0) {
    return (
      <SkyPageShell eyebrow="Quiz" title="Nothing to quiz" height={height}>
        <SkySurface className="mx-auto max-w-[560px]">
          <p className="text-[14px] text-sky-muted">Nothing is due. Learn something in the Observatory, or pick things in the Atlas and ask for a quiz.</p>
          <SkyButton href={skyHref} className="mt-4">Back to the observatory</SkyButton>
        </SkySurface>
      </SkyPageShell>
    );
  }

  if (finished) {
    return <QuizResults cards={cards} answers={answers} failed={saved === "failed"} skyHref={skyHref} pitch={pitch} onRetry={onRetry} onSave={onSave} savedNames={savedNames} next={next} height={height} />;
  }

  const context = card.prompt.context && !LABEL_ONLY.test(card.prompt.context) ? card.prompt.context : null;
  const triesLeft = maxTries - state.tries;
  const help = [
    !answered && card.typed && !state.narrowed && card.options.length > 1 ? { label: "Multiple choice", run: () => patch({ narrowed: true }) } : null,
    // a listening card's hint is the writing itself
    !answered && (card.hint || card.listen) && !state.hinted ? { label: card.listen ? "Show it" : "Hint", run: () => patch({ hinted: true }) } : null,
    !answered ? { label: "I don't know", run: giveUp } : null,
  ].filter((h): h is { label: string; run: () => void } => !!h);

  return (
    <SkyPageShell eyebrow="Quiz" title="Quiz" aside={strip} height={height}>
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
      {cardShown && <div className="mx-auto flex w-full max-w-[720px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui">
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
              <div className="flex flex-col items-center text-center">
                {listening ? (
                  // the sound in place of the glyph: a big hear button, and the
                  // reading only once it is shown or answered
                  <div className="flex flex-col items-center">
                    <Eyebrow>Listen</Eyebrow>
                    <span ref={listenRef} className="mt-1 inline-flex [&_button]:h-16 [&_button]:w-16 [&_button]:text-[26px]">{Hear && card.listen && <Hear glyph={card.listen} label="Play it again" />}</span>
                  </div>
                ) : card.prompt.within ? (
                  // the word, with the glyph asked about in ink and the rest muted
                  <p className={`font-sky-display leading-none ${japaneseFont(card.prompt.within)}`} style={{ fontSize: promptSize(card.prompt.within) }}>
                    {[...card.prompt.within].map((ch, i) => <span key={i} className={ch === card.prompt.glyph ? "text-sky-ink" : "text-sky-muted/60"}>{ch}</span>)}
                  </p>
                ) : card.prompt.jp ? (
                  // One size for every Japanese prompt, coming down only when
                  // the text is too long to fit at it (SAK-390). It used to
                  // step from 64px to 36px at three characters, so 待つ and
                  // 食べる were drawn half a size apart.
                  <p className={`font-sky-display leading-none text-sky-ink ${japaneseFont(card.prompt.glyph)}`} style={{ fontSize: promptSize(card.prompt.glyph) }}>{card.prompt.glyph}</p>
                ) : (
                  // English is a different kind of thing to read, and its
                  // letters are not square, so it keeps its own size
                  <p className="font-sky-display text-[28px] leading-none text-sky-ink">{card.prompt.glyph}</p>
                )}
                {context && !listening && <p className={`mt-3 text-[15px] text-sky-muted ${japaneseFont(context)}`}>{context}</p>}
                {card.instruction && !answered && <p className="mt-2 text-[13px] text-sky-muted">{card.instruction}</p>}
              </div>

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
                  {card.order && (
                    // the pieces: tap one to place it next, tap a placed one to
                    // take it back; Check once every piece is placed
                    <div className="flex flex-col gap-3">
                      <div className={`flex min-h-[44px] flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 ${(state.built ?? []).length ? "border-sky-line" : "border-sky-line/60"}`}>
                        {(state.built ?? []).length === 0 && <span className="text-[12.5px] text-sky-muted">Tap the pieces in order.</span>}
                        {(state.built ?? []).map((p, i) => (
                          <button key={`${p}-${i}`} type="button" onClick={() => patch({ built: (state.built ?? []).filter((_, j) => j !== i) })} className={`rounded-lg border border-sky-accent bg-sky-card-strong px-3 py-1.5 text-[17px] text-sky-ink ${japaneseFont(card.order!.pieces[p])}`}>{card.order!.pieces[p]}</button>
                        ))}
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {card.order.pieces.map((piece, i) => {
                          const placed = (state.built ?? []).includes(i);
                          return <button key={i} type="button" disabled={placed} onClick={() => patch({ built: [...(state.built ?? []), i] })} className={`rounded-lg border px-3 py-1.5 text-[17px] ${placed ? "border-transparent bg-sky-card/40 text-sky-muted/50" : "border-sky-line bg-sky-card text-sky-ink hover:border-sky-accent"} ${japaneseFont(piece)}`}>{piece}</button>;
                        })}
                      </div>
                      <div className="flex justify-center"><SkyButton onClick={submitOrder} disabled={(state.built ?? []).length !== card.order.pieces.length}>Check</SkyButton></div>
                    </div>
                  )}
                  {choices && !card.order && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {card.options.map((o, i) => {
                        const struck = state.wrong.includes(o.id);
                        const on = state.chosen === o.id;
                        const frame = struck ? "border-transparent bg-sky-card/40 text-sky-muted" : on ? "border-sky-accent bg-sky-card-strong" : "border-sky-line bg-sky-card hover:border-sky-accent";
                        // a pitched choice is a sound to judge: a numbered clip with
                        // its hear button, the reading only once a hint is asked for
                        if (o.pitch !== undefined) {
                          return (
                            <div key={o.id} className={`flex w-[calc((100%-1rem)/3)] min-w-[140px] items-center gap-1 rounded-xl border pr-2 ${frame}`}>
                              <button type="button" onClick={() => pick(o.id)} disabled={struck} aria-pressed={on} className={`flex min-h-[52px] min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left ${struck ? "line-through" : ""}`}>
                                <span className="text-[12px] text-sky-muted">{i + 1}</span>
                                {state.hinted && Pitch && <span className={`font-sky-display text-[18px] ${japaneseFont(o.label)}`}><Pitch reading={o.label} downstep={o.pitch} /></span>}
                              </button>
                              {Hear && <span ref={(el) => { if (el) hears.current.set(o.id, el); else hears.current.delete(o.id); }}><Hear glyph={o.label} downstep={o.pitch} /></span>}
                            </div>
                          );
                        }
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => pick(o.id)}
                            disabled={struck}
                            aria-pressed={on}
                            className={`flex min-h-[52px] w-[calc((100%-1rem)/3)] min-w-[140px] items-center rounded-xl border px-3 py-2.5 text-left ${frame} ${struck ? "line-through" : ""} ${o.jp ? `whitespace-nowrap font-sky-display ${japaneseFont(o.label)}` : "text-[13.5px]"}`}
                            style={o.jp ? { fontSize: optionSize(o.label) } : undefined}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* a card without a box still checks its pick with a button.
                      Never an ordering card: `choices` is true for anything not
                      typed, and that one has its own Check under its pieces. */}
                  {choices && !card.typed && !card.order && (
                    <div className="flex justify-center"><SkyButton onClick={() => submit()} disabled={!state.chosen}>Check</SkyButton></div>
                  )}
                </div>
              )}

              {answered && (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-center">
                    <Eyebrow tone="inherit" size="md" className={`mb-0 ${VERDICT[answered.grade]}`}>{GRADE[answered.grade].label}</Eyebrow>
                    <p className="mt-1 text-[13px] text-sky-muted">{GRADE[answered.grade].meaning}</p>
                  </div>
                  <p className={`text-center font-sky-display text-[28px] leading-tight text-sky-ink ${japaneseFont(card.answer)}`}>{card.answerPitch !== undefined && Pitch ? <Pitch reading={card.answer} downstep={card.answerPitch} /> : card.answer}</p>
                  {/* every attempt, in order, so the two things that were
                      confused can both be seen (SAK-387) */}
                  {answered.grade === "missed" && !!answered.said?.length && (
                    <p className="text-center text-[13px] text-sky-muted">
                      You said{" "}
                      {answered.said.map((tried, i) => (
                        <Fragment key={`${tried}-${i}`}>
                          {i > 0 && (i === answered.said!.length - 1 ? ", then " : ", ")}
                          <span className={`text-sky-ink ${japaneseFont(tried)}`}>{tried}</span>
                        </Fragment>
                      ))}.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* the bar: help while the card is open, the way on once it is done */}
            <div className="flex shrink-0 flex-col gap-2 border-t border-sky-line pt-3 md:w-[168px] md:border-t-0 md:border-l md:pl-4 md:pt-0">
              <Eyebrow>{answered ? "Move on" : `Help me${state.tries > 0 ? ` · ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left` : ""}${timeLeft !== null ? ` · ${Math.ceil(timeLeft / 1000)}s` : ""}`}</Eyebrow>
              {timeLeft !== null && timerSeconds > 0 && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-sky-line" aria-hidden>
                  <div className={`h-full transition-[width] duration-100 ease-linear ${timeLeft < 3000 ? "bg-sky-slipping" : "bg-sky-accent"}`} style={{ width: `${(timeLeft / (timerSeconds * 1000)) * 100}%` }} />
                </div>
              )}
              {answered
                ? <SkyButton block onClick={() => allAnswered ? finish(answers) : advance(at, answers)}>{allAnswered ? "Finish" : "Next"}</SkyButton>
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

        {!answered && state.hinted && card.hint && (card.hint.image || card.hint.text) && (
          // a long hint scrolls itself too, rather than pushing the card up
          <SkySurface className="flex max-h-[40vh] shrink-0 items-center gap-4 overflow-y-auto text-[14px] text-sky-ink/90">
            {card.hint.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.hint.image} alt="" className="size-[96px] rounded-md object-contain" />
            )}
            {card.hint.text && <span>{card.hint.text}</span>}
          </SkySurface>
        )}

        {answered && (
          // The lesson scrolls inside itself rather than taking the card with
          // it (SAK-392). One scroller for the whole column meant reading a
          // long grammar page carried the card, the verdict, the answer and
          // Next off the top, and the only way back to what you got wrong was
          // to scroll up. It takes whatever the card leaves and scrolls within
          // that, with a floor so it is never squeezed to nothing; past the
          // floor the column scrolls as a whole, which is the safety valve for
          // a screen too short to hold the card at all.
          <LessonCard item={card.item} teach={card.teach} madeOf={[]} partOf={[]} known={false} onSelect={() => undefined} hear={hear} pitch={pitch} className="min-h-[120px] flex-1 overflow-y-auto" />
        )}
      </div>}

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
