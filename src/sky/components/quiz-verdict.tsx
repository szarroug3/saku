"use client";

// What an answered card shows under itself: the verdict, the answer, and
// every attempt in order when it was missed (SAK-387), so the two things
// that were confused can both be seen; then why each of the other choices
// was on the board (SAK-315). And the hint a card shows while open. These
// were inline in the quiz screen (the components review, 2026-09-07);
// apart, the screen is the card and its bar.

import { Fragment } from "react";

import { Eyebrow } from "@/sky/components/sky-card";
import type { PitchComponent } from "@/sky/components/lesson-card";
import { SkySurface } from "@/sky/components/sky-panel";
import { VERDICT } from "@/sky/components/quiz-results";
import { japaneseFont } from "@/sky/lib/japanese";
import { GRADE, type QuizAnswer, type QuizCard } from "@/sky/lib/quiz";

export function QuizVerdict({ answered, answer, answerPitch, pitch: Pitch }: {
  answered: QuizAnswer;
  answer: string;
  answerPitch?: number;
  pitch?: PitchComponent;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="text-center">
        <Eyebrow tone="inherit" size="md" className={`mb-0 ${VERDICT[answered.grade]}`}>{GRADE[answered.grade].label}</Eyebrow>
        <p className="mt-1 text-[13px] text-sky-muted">{GRADE[answered.grade].meaning}</p>
      </div>
      <p className={`text-center font-sky-display text-[28px] leading-tight text-sky-ink ${japaneseFont(answer)}`}>{answerPitch !== undefined && Pitch ? <Pitch reading={answer} downstep={answerPitch} /> : answer}</p>
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
 * than pushing the card up. */
export function QuizHint({ hint }: { hint: NonNullable<QuizCard["hint"]> }) {
  if (!hint.image && !hint.text) return null;
  return (
    <SkySurface className="flex max-h-[40vh] shrink-0 items-center gap-4 overflow-y-auto text-[14px] text-sky-ink/90">
      {hint.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hint.image} alt="" className="size-[96px] rounded-md object-contain" />
      )}
      {hint.text && <span>{hint.text}</span>}
    </SkySurface>
  );
}
