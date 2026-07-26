"use client";

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import { WHY_TRACK } from "@/data/why";
import type { FactId } from "@/types";

export interface SentenceOrderingLesson {
  facts: FactId[];
  lessonNumber: number;
  totalLessons: number;
  tierId: string;
  tierLabel: string;
}

export function NextSentenceOrderingLesson({
  lesson,
  onStart,
  onQuizMe,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: SentenceOrderingLesson;
  onStart: (facts: FactId[]) => void;
  onQuizMe: (facts: FactId[]) => void;
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  return (
    <Card>
      <Lbl>
        Up next · sentence ordering · lesson {lesson.lessonNumber} of {lesson.totalLessons}
      </Lbl>

      <p className="mt-2 text-[13px] text-text-muted">
        Build real Japanese sentences by ordering chunks in context.
      </p>

      <p className="mt-4 text-[13px] text-text">{lesson.tierLabel}</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={() => onClaim(lesson.facts)}>I already know this</Btn>
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn onClick={() => onQuizMe(lesson.facts)}>Quiz me</Btn>
          {inSession && onContinue ? (
            <Btn go onClick={onContinue}>
              Continue session
            </Btn>
          ) : (
            <Btn go onClick={() => onStart(lesson.facts)}>
              Start
            </Btn>
          )}
        </div>
      </div>

      <WhyDisclosure
        why={{
          ...WHY_TRACK.grammar,
          lede: {
            strong: "Sentence ordering is where grammar and vocabulary meet.",
            rest: "You are no longer choosing one word or one pattern. You are placing chunks so the sentence works as a whole.",
          },
        }}
      />
    </Card>
  );
}
