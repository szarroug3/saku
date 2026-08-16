"use client";

// The "tap the marked word" quiz card — a Japanese sentence rendered as
// separated, tappable chunks. No pre-coloring: every chunk renders neutrally
// until the learner taps one, matching the reveal-after-answer discipline
// pairs-screen.tsx already uses for its cards (see that file's mismatch-flash
// comment). The particle itself is never tappable — it's part of the
// question, not an option — but it is boxed exactly like an answer/distractor
// piece: every sentence here is otherwise word+particle pieces, so marking the
// particle any other way (an earlier pass underlined it in the accent color)
// let a learner spot the answer's boundary without reading the sentence at
// all. Only plain connecting text between pieces stays unboxed.
//
// Package 4 of docs/particle-teaching-workplan.md. Pure presentation: grading
// is lib/engine/particle-drill.ts's job, this component only reports which
// chunk was tapped.

import { useState } from "react";

import type { ParticleDrillChunk, ParticleDrillQuestion } from "@/lib/engine/particle-drill";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface ParticleTapCardProps {
  question: ParticleDrillQuestion;
  /** No further taps land — the card already resolved (a correct tap, or
   * retries exhausted). */
  disabled: boolean;
  /** Retries are exhausted and the setting to show answers is on: light the
   * correct chunk even if the learner never landed on it, the same "reveal
   * the right one alongside your wrong pick" the MC grid does. */
  revealCorrect: boolean;
  onTap: (chunkId: string) => void;
}

type TapState = "correct" | "wrong";

export function ParticleTapCard({
  question,
  disabled,
  revealCorrect,
  onTap,
}: ParticleTapCardProps) {
  const [tapped, setTapped] = useState<Record<string, TapState>>({});
  // A NEW question (new card, or a redraw of the same fact) always starts
  // neutral — reset DURING render rather than in an effect (the React-docs
  // "adjusting state when a prop changes" pattern), keyed on the question
  // object's identity, which particleDrillFor freshly builds on every ask,
  // exactly as grammarSelection/recognition do.
  const [prevQuestion, setPrevQuestion] = useState(question);
  if (prevQuestion !== question) {
    setPrevQuestion(question);
    setTapped({});
  }

  function handleTap(chunk: ParticleDrillChunk) {
    if (disabled || !chunk.tappable || tapped[chunk.id]) return;
    const outcome: TapState = chunk.id === question.answerChunkId ? "correct" : "wrong";
    setTapped((prev) => ({ ...prev, [chunk.id]: outcome }));
    onTap(chunk.id);
  }

  return (
    <p
      lang="ja"
      className="max-w-[320px] text-center text-2xl leading-loose wrap-break-word"
    >
      {question.chunks.map((chunk) => {
        if (chunk.role === "text") {
          return (
            <span key={chunk.id} className="inline-block">
              {chunk.text}
            </span>
          );
        }
        if (chunk.role === "particle") {
          // Boxed the same as a tappable piece (see the header comment) — a
          // plain span, not a button: it never takes taps or a tap outcome.
          return (
            <span
              key={chunk.id}
              className="mx-0.5 inline-block cursor-default rounded-md border border-border bg-transparent px-1.5 py-0.5 align-baseline text-text"
            >
              {chunk.text}
            </span>
          );
        }
        const outcome = tapped[chunk.id];
        const revealed = !outcome && revealCorrect && chunk.id === question.answerChunkId;
        return (
          <button
            key={chunk.id}
            type="button"
            onClick={() => handleTap(chunk)}
            disabled={disabled || !!outcome}
            className={cx(
              "mx-0.5 inline-block cursor-pointer rounded-md border px-1.5 py-0.5 align-baseline transition-colors duration-150",
              outcome === "correct" || revealed
                ? "border-success bg-success-bg text-success"
                : outcome === "wrong"
                  ? "border-danger bg-danger-bg text-danger"
                  : "border-border bg-transparent text-text hover:bg-panel",
            )}
          >
            {chunk.text}
          </button>
        );
      })}
    </p>
  );
}
