"use client";

import type { ReactNode } from "react";

import { PhaseIntroView } from "@/components/lesson/phase-intro-view";
import { ConfigPreview } from "@/components/quiz/config-preview";
import { AttributionLink } from "@/components/library/attribution-link";
import { Btn } from "@/components/ui";
import type { PhaseIntro } from "@/data/phase-intros";

const SENTENCE_ORDERING_INTRO: PhaseIntro = {
  id: "track-sentence-ordering",
  setId: "",
  eyebrow: "What sentence ordering is",
  title: "Japanese usually puts the main action near the end, not in English word order.",
  body: [
    {
      lead: "English and Japanese build sentences differently.",
      text: "English is usually Subject-Verb-Object: \"Sam eats sushi.\" Japanese is usually Topic/Subject-Object-Verb, so the action chunk tends to be near the end.",
    },
    {
      lead: "It is not simply \"nouns first\".",
      text: "Time, place and topic chunks can be placed early. Particles show each chunk's role, so order follows structure as opposed to how English positions words.",
    },
    {
      lead: "Verb choice does not usually rewrite the whole order.",
      text: "The specific verb form can change, but the sentence-final action pattern is still the default.",
    },
  ],
};

const LESSONS = [
  {
    id: "step-1-ending",
    step: "Step 1",
    title: "Verb or statement ending",
    details: [
      "Japanese usually puts the verb or statement ending near the end of the sentence.",
      "Find that ending chunk first and anchor it on the right.",
    ],
    examples: [
      {
        en: "Saku seemed busy.",
        enChunk: "seemed",
        enOrdered: "As for Saku, (he) seemed busy.",
        enOrderedChunk: "seemed",
        jp: "サクは忙しそうだった。",
        chunk: "だった",
      },
      {
        en: "Saku went to the store.",
        enChunk: "went",
        enOrdered: "As for Saku, to the store, (he) went.",
        enOrderedChunk: "went",
        jp: "サクは店に行った。",
        chunk: "行った",
      },
      {
        en: "Saku had a fun time at the park.",
        enChunk: "had",
        enOrdered: "As for Saku, at the park, a fun time, (he) had.",
        enOrderedChunk: "had",
        jp: "サクは公園で楽しい時間を過ごした。",
        chunk: "過ごした",
      },
    ],
  },
  {
    id: "step-2-setting",
    step: "Step 2",
    title: "Core meaning chunk",
    details: [
      "After anchoring the ending, place the core meaning chunk directly before it.",
      "This is often what the ending is describing or completing (for example: busy / to the store / a fun time).",
    ],
    examples: [
      {
        en: "Saku seemed busy.",
        enChunk: "busy",
        enOrdered: "As for Saku, (he) seemed busy.",
        enOrderedChunk: "busy",
        jp: "サクは忙しそうだった。",
        chunk: "忙しそう",
      },
      {
        en: "Saku went to the store.",
        enChunk: "to the store",
        enOrdered: "As for Saku, to the store, (he) went.",
        enOrderedChunk: "to the store",
        jp: "サクは店に行った。",
        chunk: "店に",
      },
      {
        en: "Saku had a fun time at the park.",
        enChunk: "a fun time",
        enOrdered: "As for Saku, at the park, a fun time, (he) had.",
        enOrderedChunk: "a fun time",
        jp: "サクは公園で楽しい時間を過ごした。",
        chunk: "楽しい時間を",
      },
    ],
  },
  {
    id: "step-3-middle",
    step: "Step 3",
    title: "Topic and context chunk(s)",
    details: [
      "Now place the topic and context chunks on the left side.",
      "These are usually the 'as for who/what' chunk and any place/time context chunks.",
    ],
    examples: [
      {
        en: "Saku seemed busy.",
        enChunk: "Saku",
        enOrdered: "As for Saku, (he) seemed busy.",
        enOrderedChunk: "As for Saku",
        jp: "サクは忙しそうだった。",
        chunk: "サクは",
      },
      {
        en: "Saku went to the store.",
        enChunk: "Saku",
        enOrdered: "As for Saku, to the store, (he) went.",
        enOrderedChunk: "As for Saku",
        jp: "サクは店に行った。",
        chunk: "サク",
      },
      {
        en: "Saku had a fun time at the park.",
        enChunk: "Saku",
        enOrdered: "As for Saku, at the park, a fun time, (he) had.",
        enOrderedChunk: "As for Saku",
        jp: "サクは公園で楽しい時間を過ごした。",
        chunk: "サクは",
      },
    ],
  },
  {
    id: "step-4-particles",
    step: "Particles",
    title: "Read particles as role labels",
    details: [
      "Particles help you decide where a chunk belongs in the sentence frame.",
      "Use them as ordering hints while you place chunks.",
      "は topic, が subject, を object, に/で/へ place-time-direction",
    ],
    examples: [
      {
        en: "Saku seemed busy.",
        enChunk: "Saku",
        enOrdered: "As for Saku, (he) seemed busy.",
        enOrderedChunk: "As for",
        jp: "サクは忙しそうだった。",
        chunk: "は",
      },
      {
        en: "Saku went to the store.",
        enChunk: "to the store",
        enOrdered: "As for Saku, to the store, (he) went.",
        enOrderedChunk: "to",
        jp: "サクは店に行った。",
        chunk: "に",
      },
      {
        en: "Saku had a fun time at the park.",
        enChunk: "at the park",
        enOrdered: "As for Saku, at the park, a fun time, (he) had.",
        enOrderedChunk: "at",
        jp: "サクは公園で楽しい時間を過ごした。",
        chunk: "で",
      },
    ],
  },
] as const;

function highlightChunk(sentence: string, chunk?: string): ReactNode {
  if (!chunk) return sentence;
  const i = sentence.indexOf(chunk);
  if (i < 0) return sentence;
  const before = sentence.slice(0, i);
  const after = sentence.slice(i + chunk.length);
  return (
    <>
      {before}
      <span className="text-accent">{chunk}</span>
      {after}
    </>
  );
}

export const SENTENCE_ORDERING_TEACH_STEPS = 1 + LESSONS.length;

export function SentenceOrderingTeachWalk({
  step,
  onStep,
  onStart,
}: {
  step: number;
  onStep: (n: number) => void;
  onStart: () => void;
}) {
  const at = Math.max(0, Math.min(step, SENTENCE_ORDERING_TEACH_STEPS - 1));
  const onIntro = at === 0;
  const lesson = onIntro ? null : LESSONS[at - 1];
  const last = at === SENTENCE_ORDERING_TEACH_STEPS - 1;

  return (
    <div className="mx-auto max-w-230 px-3">
      <div className="flex min-h-5 items-center gap-3" />

      <div className="mt-2">
        {onIntro ? (
          <PhaseIntroView intro={SENTENCE_ORDERING_INTRO} />
        ) : lesson ? (
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                {lesson.step}
              </p>
              <h2 className="mt-3 max-w-[26ch] text-[34px] font-light leading-[1.2] tracking-[-0.4px] text-text">
                {lesson.title}
              </h2>
            </div>

            <div className="border-t border-border pt-7">
              <div className="space-y-2 text-[15px] leading-relaxed text-text">
                {lesson.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>

                <div className="mt-2 space-y-3">
                  {lesson.examples.map((example, idx) => (
                    <div key={`${example.en}-${example.jp}`} className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                        Example {idx + 1}
                      </p>
                      <p className="text-[14px] text-text-muted">
                        {highlightChunk(example.en, example.enChunk)}
                      </p>
                      <p className="mt-1 text-[13px] text-text-muted">
                        {highlightChunk(example.enOrdered, example.enOrderedChunk)}
                      </p>
                      <p lang="ja" className="mt-1 text-[20px] font-light text-text">
                        {highlightChunk(example.jp, example.chunk)}
                      </p>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        ) : null}
      </div>

      {last ? (
        <div className="mt-4 rounded-lg border border-border bg-panel px-3 py-2">
          <ConfigPreview />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Btn
          onClick={() => onStep(at - 1)}
          disabled={at === 0}
          className="disabled:cursor-default disabled:opacity-40"
        >
          Back
        </Btn>
        <Btn go autoFocus onClick={last ? onStart : () => onStep(at + 1)}>
          {last ? "Quiz me" : "Next"}
        </Btn>
      </div>

      <AttributionLink />
    </div>
  );
}
