"use client";

// What an answered card shows under itself: the verdict, what was said on the
// way to the answer, and the answer; then which reading applies here and why
// (SAK-316), and why each of the other choices was on the board (SAK-315). And
// the hint a card shows while open. These were inline in the quiz screen (the
// components review, 2026-09-07); apart, the screen is the card and its bar.
//
// Every attempt is listed, in order, either way (SAK-387, SAK-425). A missed
// card lists them all under the answer, so the two things that were confused
// can both be seen. A card that was answered in the end lists the wrong ones
// ABOVE it, struck through: the last thing said on that card IS the answer and
// is already drawn large, and what a card answered after a retry was missing
// was everything before it.

import { Fragment } from "react";

import { Eyebrow } from "@/sky/components/sky-card";
import type { PitchComponent } from "@/sky/components/lesson-card";
import { SkySurface } from "@/sky/components/sky-panel";
import { VERDICT } from "@/sky/components/quiz-results";
import { japaneseFont } from "@/sky/lib/japanese";
import { GRADE, triedBefore, type QuizAnswer, type QuizCard, type QuizRule } from "@/sky/lib/quiz";

/** The attempts as a sentence: "A", "A, then B", "A, B, then C". Struck
 * through when they are the wrong ones on the way to a right answer. */
function Attempts({ said, wrong = false }: { said: readonly string[]; wrong?: boolean }) {
  return (
    <>
      {said.map((tried, i) => (
        <Fragment key={`${tried}-${i}`}>
          {i > 0 && (i === said.length - 1 ? ", then " : ", ")}
          <span className={`${wrong ? "text-sky-slipping line-through" : "text-sky-ink"} ${japaneseFont(tried)}`}>{tried}</span>
        </Fragment>
      ))}
    </>
  );
}

export function QuizVerdict({ answered, answer, answerPitch, pitch: Pitch }: {
  answered: QuizAnswer;
  answer: string;
  answerPitch?: number;
  pitch?: PitchComponent;
}) {
  // What was said before the right answer (SAK-425). A card answered after a
  // retry, a hint or the choices used to show the right answer and nothing
  // else, so stepping back to it lost what the learner had actually said,
  // which is the part of that card worth looking at. It goes ABOVE the answer,
  // struck through, so the two read in the order they happened.
  const before = triedBefore(answered);
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="text-center">
        <Eyebrow tone="inherit" size="md" tight className={VERDICT[answered.grade]}>{GRADE[answered.grade].label}</Eyebrow>
        <p className="mt-1 text-[13px] text-sky-muted">{GRADE[answered.grade].meaning}</p>
      </div>
      {before.length > 0 && (
        <p className="text-center text-[13px] text-sky-muted">
          You said <Attempts said={before} wrong /> before this.
        </p>
      )}
      <p className={`text-center font-sky-display text-[28px] leading-tight text-sky-ink ${japaneseFont(answer)}`}>{answerPitch !== undefined && Pitch ? <Pitch reading={answer} downstep={answerPitch} /> : answer}</p>
      {answered.grade === "missed" && !!answered.said?.length && (
        <p className="text-center text-[13px] text-sky-muted">
          You said <Attempts said={answered.said} />.
        </p>
      )}
    </div>
  );
}

/** Which reading applies here, and why (SAK-316).
 *
 * The quiz is mostly not asking what a thing means. It is asking which
 * reading applies, because that is the part of Japanese that actually goes
 * wrong: 水 is みず alone and すい in 水曜日. So the reveal explains the rule
 * rather than confirming the answer a second time.
 *
 * The prose on the left, the character's readings on the right with the one
 * that applies marked, because a reading is worth little except against the
 * ones that did not apply. Both come from the route: the wording is authored
 * per rule, not per item, so every card that exercises the same rule says the
 * same thing, and a card whose rule cannot be named honestly carries none.
 */
export function QuizRuleBlock({ rule }: { rule: QuizRule }) {
  return (
    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
      <div className="min-w-0 flex-1">
        <Eyebrow>{rule.title}</Eyebrow>
        <p className="text-[13.5px] leading-relaxed text-sky-ink/90">{rule.prose}</p>
      </div>
      {!!rule.readings?.length && (
        <ul className="flex shrink-0 flex-col gap-1 md:w-[188px]">
          {rule.readings.map((r) => (
            <li key={r.reading} className={`flex flex-wrap items-baseline gap-x-2 rounded-lg px-2 py-1 text-[12.5px] ${r.applies ? "bg-sky-card-strong" : ""}`}>
              <span className={`font-sky-display text-[15px] ${r.applies ? "text-sky-ink" : "text-sky-muted"} ${japaneseFont(r.reading)}`}>{r.reading}</span>
              {r.kind && <span className={r.applies ? "text-sky-ink/80" : "text-sky-muted"}>{r.kind}</span>}
              {r.inWord && <span className={`${r.applies ? "text-sky-ink/60" : "text-sky-muted/70"} ${japaneseFont(r.inWord)}`}>{r.inWord}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Why the other choices were on the board (SAK-315).
 *
 * A random distractor tests nothing, because you can throw it out without
 * knowing anything. The board is the confusable set instead, so every wrong
 * choice on it is the shape of a mistake you were about to make, and this
 * says which shape: "another reading of the same character", "drawn almost
 * the same". Even the escape hatch teaches.
 *
 * The route works the reasons out and hangs them on the options; an option it
 * cannot name honestly carries nothing and is left out, since a vague reason
 * is worse than none. Nothing to name, nothing shown.
 */
export function QuizWhy({ card, pitch: Pitch }: { card: QuizCard; pitch?: PitchComponent }) {
  const others = card.options.filter((o) => o.id !== card.answerId && o.why);
  if (others.length === 0) return null;
  return (
    <div className="mt-4">
      <Eyebrow>Why the others were there</Eyebrow>
      <ul className="flex flex-col gap-1">
        {others.map((o) => (
          <li key={o.id} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
            <span className={`text-sky-ink ${japaneseFont(o.label)}`}>
              {o.pitch !== undefined && Pitch ? <Pitch reading={o.label} downstep={o.pitch} /> : o.label}
            </span>
            <span className="text-sky-muted">{o.why}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A card's hint, shown once asked for: a long one scrolls itself rather
 * than pushing the card up. The text is written a line at a time, so a hint
 * that is Japanese on one line and English on the next (a known word's
 * reading over its component breakdown, SAK-429) draws each in its own face
 * instead of putting the whole thing in the UI one.
 *
 * A grammar card's hint is two things and they are drawn as two (SAK-427): the
 * line that says what kind of word this is, in the UI face because it is a
 * sentence, then the arithmetic that builds the answer, one equation to the
 * line in the Japanese face because it is Japanese and is meant to be read.
 * Down the page rather than across, so the equations line up on their left
 * edges and the second reads as the first one continued. */
export function QuizHint({ hint }: { hint: NonNullable<QuizCard["hint"]> }) {
  const steps = hint.steps ?? [];
  if (!hint.image && !hint.text && !steps.length) return null;
  return (
    <SkySurface className="flex max-h-[40vh] shrink-0 items-center gap-4 overflow-y-auto text-[14px] text-sky-ink/90">
      {hint.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hint.image} alt="" className="size-[96px] rounded-md object-contain" />
      )}
      {(hint.text || steps.length > 0) && (
        <div className="flex min-w-0 flex-col gap-1">
          {hint.text?.split("\n").map((line, i) => <span key={i} className={japaneseFont(line)}>{line}</span>)}
          {steps.map((step) => (
            <span key={step} className={`text-[17px] leading-snug text-sky-ink ${japaneseFont(step)}`}>{step}</span>
          ))}
        </div>
      )}
    </SkySurface>
  );
}
