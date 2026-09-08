"use client";

// What an answered card shows under itself: the verdict, the answer, and
// every attempt in order when it was missed (SAK-387), so the two things
// that were confused can both be seen. And the hint a card shows while
// open. Both were inline in the quiz screen (the components review,
// 2026-09-07); apart, the screen is the card and its bar.

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
