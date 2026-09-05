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
// another try, MAX_TRIES in all, before the card is missed and its answer
// shown with the lesson's own card. Help is a small row of buttons:
// multiple choice, a hint, giving up. At the end, the three counts and
// what each does to the schedule, then the answers go to whoever records
// them.

import { useEffect, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";

import { LessonCard, type HearComponent, type PitchComponent } from "@/sky/components/lesson-card";
import { RoundButton, SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { Eyebrow } from "@/sky/components/sky-card";
import { japaneseFont } from "@/sky/lib/japanese";
import { GRADE, GRADES, gradeFor, MAX_TRIES, tally, type Grade, type QuizAnswer, type QuizCard } from "@/sky/lib/quiz";
import { KIND_LABEL } from "@/sky/lib/tokens";

export interface SkyQuizProps {
  cards: readonly QuizCard[];
  /** Whether what was typed answers the card. */
  grade: (card: QuizCard, given: string) => boolean;
  /** Where the answers go when the session ends: the schedule. */
  onFinish?: (answers: readonly QuizAnswer[]) => Promise<void>;
  /** Back to the observatory. */
  skyHref: string;
  hear?: HearComponent;
  pitch?: PitchComponent;
  /** An info mark that shows `children` on hover: the app's own tooltip. */
  tip?: ComponentType<{ label: string; children: ReactNode }>;
  /** Starts a new quiz of just these cards, from the results. */
  onRetry?: (cardIds: readonly string[]) => void;
  height?: string;
}

/** The pip and verdict colours, by grade. */
const PIP: Record<Grade, string> = {
  clean: "bg-sky-solid",
  help: "bg-sky-shaky",
  missed: "bg-sky-slipping",
};
const VERDICT: Record<Grade, string> = {
  clean: "text-sky-solid",
  help: "text-sky-shaky",
  missed: "text-sky-slipping",
};

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
}

const FRESH: Open = { tries: 0, narrowed: false, hinted: false, wrong: [] };

export function SkyQuiz({ cards, grade, onFinish, skyHref, hear, pitch, tip, onRetry, height }: SkyQuizProps) {
  const Pitch = pitch;
  const Hear = hear;
  const Tip = tip;
  // rows picked on the results, for a retry of just those; shift picks a run
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [lastPick, setLastPick] = useState<number | null>(null);
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Readonly<Record<string, QuizAnswer>>>({});
  const [open, setOpen] = useState<Readonly<Record<string, Open>>>({});
  const [given, setGiven] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState<"no" | "saving" | "yes" | "failed">("no");
  const input = useRef<HTMLInputElement>(null);

  const card = cards[at];
  const state = card ? (open[card.id] ?? FRESH) : FRESH;
  const answered = card ? answers[card.id] : undefined;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = cards.length > 0 && answeredCount === cards.length;
  // the choices show when asked for, or on a card only ever asked that way
  const choices = card ? (state.narrowed || !card.typed) : false;
  // a card of two choices is wrong after one wrong pick; a typed card, or a
  // fuller board, gets the retries
  const maxTries = card ? (card.typed ? MAX_TRIES : Math.min(MAX_TRIES, Math.max(1, card.options.length - 1))) : MAX_TRIES;

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
    const answer: QuizAnswer = { cardId: card.id, grade: g, tries: Math.max(1, tries), narrowed: state.narrowed, hinted: state.hinted, given: given.trim() || undefined, ...extra };
    const all = { ...answers, [card.id]: answer };
    setAnswers(all);
    return all;
  };

  /** A right answer moves straight on; a wrong one costs a try. */
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = given.trim();
    if (!text || answered) return;
    const tries = state.tries + 1;
    if (grade(card, text)) {
      const all = settle(gradeFor(tries > 1 || state.narrowed || state.hinted), tries);
      advance(at, all);
      return;
    }
    if (tries >= maxTries) { settle("missed", tries); setFeedback(null); return; }
    patch({ tries });
    setGiven("");
    setFeedback(`Not that. ${maxTries - tries === 1 ? "One more try." : `${maxTries - tries} tries left.`}`);
  };

  const choose = (id: string) => {
    if (answered || state.wrong.includes(id)) return;
    const tries = state.tries + 1;
    // a card that opens on its choices is answered cold: help is only what
    // was asked for (the choices on a typed card, a hint) or a retry
    if (id === card.answerId) { const all = settle(gradeFor(tries > 1 || state.narrowed || state.hinted), tries, { given: undefined }); advance(at, all); return; }
    if (tries >= maxTries) { settle("missed", tries, { given: card.options.find((o) => o.id === id)?.label }); setFeedback(null); return; }
    patch({ tries, wrong: [...state.wrong, id] });
    setFeedback(`Not that one. ${maxTries - tries === 1 ? "One more try." : `${maxTries - tries} tries left.`}`);
  };

  const giveUp = () => { if (!answered) { settle("missed", state.tries + 1, { given: undefined }); setFeedback(null); } };

  const go = (n: number) => { if (n >= 0 && n < cards.length) { setAt(n); setGiven(""); setFeedback(null); } };

  // Enter moves on from a missed card's reveal; the arrow keys step through
  // the cards when the box is empty
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.key === "Enter" && answered) { e.preventDefault(); if (allAnswered) finish(answers); else advance(at, answers); }
      if (e.key === "ArrowLeft" && !given) go(at - 1);
      if (e.key === "ArrowRight" && !given) go(at + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const strip = (
    <div className="flex items-center gap-3 font-sky-ui text-[12.5px] text-sky-muted">
      <div className="flex items-center gap-1" aria-label="The cards">
        {cards.map((c, i) => {
          const a = answers[c.id];
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => { if (!finished) go(i); }}
              title={`${i + 1} of ${cards.length}${a ? `: ${GRADE[a.grade].label}` : ""}`}
              aria-label={`Card ${i + 1}${a ? `, ${GRADE[a.grade].label}` : ""}`}
              aria-current={i === at && !finished ? "step" : undefined}
              className={`h-2.5 w-4 rounded-full transition-colors ${a ? PIP[a.grade] : "bg-sky-muted/70 hover:bg-sky-ink"} ${i === at && !finished ? "ring-2 ring-sky-ink ring-offset-1 ring-offset-transparent" : ""}`}
            />
          );
        })}
      </div>
      <span className="tabular-nums">{finished ? `${answeredCount} of ${cards.length}` : `${at + 1} of ${cards.length}`}</span>
      {!finished && cards.length > 0 && <SkyButton variant="quiet" onClick={() => finish(answers)}>End the quiz</SkyButton>}
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
    const list = cards.map((c) => answers[c.id]).filter((a): a is QuizAnswer => !!a);
    const counts = tally(list);
    const unanswered = cards.length - list.length;
    return (
      <SkyPageShell eyebrow="Quiz" title="How it went" aside={strip} height={height}>
        <div className="mx-auto flex w-full max-w-[720px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui">
          <SkySurface>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-center sm:grid-cols-4">
              {GRADES.map((g) => (
                <div key={g}>
                  <dd className="font-sky-display text-[28px] leading-none text-sky-ink">{counts[g]}</dd>
                  <dt className={`mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${VERDICT[g]}`}>
                    {GRADE[g].label}
                    {Tip && <Tip label={`What ${GRADE[g].label.toLowerCase()} means`}>{GRADE[g].meaning}</Tip>}
                  </dt>
                </div>
              ))}
              <div>
                <dd className="font-sky-display text-[28px] leading-none text-sky-ink">{unanswered}</dd>
                <dt className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-muted">
                  Unanswered
                  {Tip && <Tip label="What unanswered means">Left when the quiz ended. Not recorded.</Tip>}
                </dt>
              </div>
            </dl>
          </SkySurface>
          {/* the list fills the page and scrolls inside; a row can be picked
              for a retry of just those cards, shift for a run (Sam, 2026-09-05) */}
          <SkySurface className="flex min-h-0 flex-1 flex-col">
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {cards.map((c, i) => {
                const a = answers[c.id];
                const on = picked.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={(e) => {
                        const next = new Set(picked);
                        if (e.shiftKey && lastPick !== null) {
                          for (let k = Math.min(lastPick, i); k <= Math.max(lastPick, i); k++) next.add(cards[k].id);
                        } else if (on) next.delete(c.id);
                        else next.add(c.id);
                        setPicked(next);
                        setLastPick(i);
                      }}
                      className={`flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg border px-2.5 py-2 text-left ${on ? "border-sky-accent bg-sky-card-strong" : "border-transparent hover:bg-sky-card"}`}
                    >
                      <span className={`font-sky-display text-[20px] leading-none text-sky-ink ${japaneseFont(c.item.glyph)}`}>{c.item.glyph}</span>
                      <span className={`text-[13px] ${japaneseFont(c.answer)}`}>{c.answer}</span>
                      <span className={`ml-auto text-[12px] font-semibold ${a ? VERDICT[a.grade] : "text-sky-muted"}`}>{a ? GRADE[a.grade].label : "Unanswered"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 shrink-0 text-[12.5px] text-sky-muted">
              {!onFinish ? "A look only: nothing was recorded." : saved === "saving" ? "Recording…" : saved === "yes" ? "Recorded against your schedule." : saved === "failed" ? "Could not record this. Your schedule is unchanged." : ""}
            </p>
          </SkySurface>
          <div className="flex flex-wrap gap-2">
            <SkyButton href={skyHref}>Back to the observatory</SkyButton>
            {onRetry && picked.size > 0 && <SkyButton variant="outline" onClick={() => onRetry(cards.filter((c) => picked.has(c.id)).map((c) => c.id))}>Retry {picked.size === 1 ? "this one" : `these ${picked.size}`}</SkyButton>}
          </div>
        </div>
      </SkyPageShell>
    );
  }

  const meta = [KIND_LABEL[card.item.kind], card.seen > 0 ? `seen ${card.seen} ${card.seen === 1 ? "time" : "times"}` : "first time", card.missed > 0 ? `missed ${card.missed} ${card.missed === 1 ? "time" : "times"} before` : null].filter(Boolean).join(" · ");
  const context = card.prompt.context && !LABEL_ONLY.test(card.prompt.context) ? card.prompt.context : null;
  const triesLeft = maxTries - state.tries;
  const help = [
    !answered && card.typed && !state.narrowed && card.options.length > 1 ? { label: "Multiple choice", run: () => patch({ narrowed: true }) } : null,
    !answered && card.hint && !state.hinted ? { label: "Hint", run: () => patch({ hinted: true }) } : null,
    !answered ? { label: "I don't know", run: giveUp } : null,
  ].filter((h): h is { label: string; run: () => void } => !!h);

  return (
    <SkyPageShell eyebrow="Quiz" title="Quiz" aside={strip} height={height}>
      {/* one width for the box whatever is on the card, so the arrows stay
          put while stepping back and forth; the help is a bar down its right
          side, so the box may grow downward for the choices without anything
          above moving (Sam, 2026-09-05); no arrow past either end. A hint,
          and a missed card's lesson, open in the panel underneath. */}
      <div className="mx-auto flex w-full max-w-[720px] min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui">
        <SkySurface className="flex shrink-0 flex-col">
          <div className="flex items-center justify-between gap-3">
            <span className={at === 0 ? "invisible" : ""}><RoundButton label="Back a card" onClick={() => go(at - 1)}>‹</RoundButton></span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">{meta}</p>
            <span className={at === cards.length - 1 ? "invisible" : ""}><RoundButton label="Skip to the next card" onClick={() => go(at + 1)}>›</RoundButton></span>
          </div>
          <div className="mt-3 flex min-h-0 flex-1 gap-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-col items-center text-center">
                {card.prompt.within ? (
                  // the word, with the glyph asked about in ink and the rest muted
                  <p className={`font-sky-display text-[56px] leading-none ${japaneseFont(card.prompt.within)}`}>
                    {[...card.prompt.within].map((ch, i) => <span key={i} className={ch === card.prompt.glyph ? "text-sky-ink" : "text-sky-muted/60"}>{ch}</span>)}
                  </p>
                ) : (
                  <p className={`font-sky-display leading-none text-sky-ink ${card.prompt.jp ? ([...card.prompt.glyph].length <= 2 ? "text-[64px]" : "text-[36px]") : "text-[28px]"} ${japaneseFont(card.prompt.glyph)}`}>{card.prompt.glyph}</p>
                )}
                {context && <p className={`mt-3 text-[15px] text-sky-muted ${japaneseFont(context)}`}>{context}</p>}
                {card.instruction && !answered && <p className="mt-2 text-[13px] text-sky-muted">{card.instruction}</p>}
              </div>

              {!answered && (
                <div className="mt-4 flex flex-col gap-3">
                  {feedback && <p className="text-center text-[13px] text-sky-slipping">{feedback}</p>}
                  {card.typed && (
                    <form onSubmit={submit} className="flex gap-2">
                      <input
                        ref={input}
                        value={given}
                        onChange={(e) => setGiven(e.target.value)}
                        placeholder={card.answerIs === "reading" ? "The reading, in romaji" : card.answerIs === "meaning" ? "The meaning, in English" : "Your answer"}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        className="min-w-0 flex-1 rounded-xl border border-sky-muted/45 bg-sky-card px-4 py-2.5 text-[16px] text-sky-ink placeholder:text-sky-muted focus:border-sky-accent focus:outline-none"
                      />
                      <SkyButton onClick={() => submit()} disabled={!given.trim()}>Check</SkyButton>
                    </form>
                  )}
                  {choices && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {card.options.map((o) => {
                        const struck = state.wrong.includes(o.id);
                        // a pitched choice holds a hear button of its own, so the
                        // pick is a button beside it rather than around it
                        if (o.pitch !== undefined && Pitch) {
                          return (
                            <div key={o.id} className={`flex w-[calc((100%-1rem)/3)] min-w-[140px] items-center gap-1 rounded-xl border pr-2 ${struck ? "border-transparent bg-sky-card/40 text-sky-muted" : "border-sky-line bg-sky-card hover:border-sky-accent"}`}>
                              <button type="button" onClick={() => choose(o.id)} disabled={struck} className={`min-w-0 flex-1 px-3 py-2.5 text-left font-sky-display text-[18px] ${struck ? "line-through" : ""} ${japaneseFont(o.label)}`}>
                                <Pitch reading={o.label} downstep={o.pitch} />
                              </button>
                              {Hear && <Hear glyph={o.label} downstep={o.pitch} />}
                            </div>
                          );
                        }
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => choose(o.id)}
                            disabled={struck}
                            className={`w-[calc((100%-1rem)/3)] min-w-[140px] rounded-xl border px-3 py-2.5 text-left ${struck ? "border-transparent bg-sky-card/40 text-sky-muted line-through" : "border-sky-line bg-sky-card hover:border-sky-accent"} ${o.jp ? `font-sky-display text-[18px] ${japaneseFont(o.label)}` : "text-[13.5px]"}`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {answered && (
                <div className="mt-4 flex flex-col gap-2">
                  <p className="text-center">
                    <span className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${VERDICT[answered.grade]}`}>{GRADE[answered.grade].label}</span>
                    <span className="mt-1 block text-[13px] text-sky-muted">{GRADE[answered.grade].meaning}</span>
                  </p>
                  <p className={`text-center font-sky-display text-[28px] leading-tight text-sky-ink ${japaneseFont(card.answer)}`}>{card.answer}</p>
                  {answered.grade === "missed" && answered.given && <p className="text-center text-[13px] text-sky-muted">You put <span className={`text-sky-ink ${japaneseFont(answered.given)}`}>{answered.given}</span>.</p>}
                </div>
              )}
            </div>

            {/* the bar: help while the card is open, the way on once it is done */}
            <div className="flex w-[168px] shrink-0 flex-col gap-2 border-l border-sky-line pl-4">
              <Eyebrow>{answered ? "Then" : `Help me${state.tries > 0 ? ` · ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left` : ""}`}</Eyebrow>
              {answered
                ? <SkyButton block onClick={() => allAnswered ? finish(answers) : advance(at, answers)}>{allAnswered ? "Finish" : "Next"}</SkyButton>
                : help.map((h) => <SkyButton key={h.label} variant="outline" block onClick={h.run}>{h.label}</SkyButton>)}
            </div>
          </div>
        </SkySurface>

        {!answered && state.hinted && card.hint && (
          <SkySurface className="flex items-center gap-4 text-[14px] text-sky-ink/90">
            {card.hint.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.hint.image} alt="" className="size-[96px] rounded-md object-contain" />
            )}
            {card.hint.text && <span>{card.hint.text}</span>}
          </SkySurface>
        )}

        {answered && (
          <LessonCard item={card.item} teach={card.teach} madeOf={[]} partOf={[]} known={false} onSelect={() => undefined} hear={hear} pitch={pitch} />
        )}
      </div>
    </SkyPageShell>
  );
}
