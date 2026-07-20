"use client";

// The most recent run you have going — and NOTHING when there isn't one.
//
// Several runs can be in progress at once now (see PARKING in quiz-session).
// Practice shows the ONE you touched last; every other run lives on the Current
// sessions page. This card resumes both kinds:
//
//   • a QUIZ (kind="quiz"): the one-off startQuiz makes — from this page, or the
//     Library's "Quiz me N" button. It lives in the provider's `active` leg with
//     `session` null, and its runtime (the deck, your position, every card's
//     state) is snapshotted to localStorage as you answer. Continue re-enters
//     the very card you left on; there is nothing to restart.
//
//   • a SESSION (kind="session"): the teach → drill → rest loop startSession
//     makes — a Library "Teach me N" run or a curriculum lesson. Continue lands
//     on whatever step it's on: the lesson, the drill, or the rest between
//     rounds (continueRun knows the phase).
//
// The page passes exactly one run (runs[0], the most recent) and wires Continue
// and Discard to that run's id.
//
// NO CONFIRM DIALOG, EVER — every answer is already on disk, so leaving costs
// nothing and Discard needs no "are you sure".

import { Btn, Card, Hint, SmallBtn } from "@/components/ui";
import type { QuizProgress } from "@/lib/quiz-session";

/** "2 hours ago". Coarse on purpose — this is a nudge, not a stopwatch. */
function ago(ts: number, now: number): string {
  const mins = Math.round((now - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function PracticeResume({
  kind,
  what,
  progress,
  /** When it was started. Optional: a run snapshotted before this field existed
   * restores without it, and the "started …" line is then omitted rather than
   * inventing a time. */
  startedAt,
  /** Passed in rather than read here so the card can be rendered without the
   * markup disagreeing with the client a moment later. Null until mounted. */
  now,
  onContinue,
  onDiscard,
}: {
  kind: "quiz" | "session";
  what: string;
  progress: QuizProgress | null;
  startedAt?: number;
  now: number | null;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const noun = kind === "quiz" ? "quiz" : "lesson";

  // Only claim a count when there is one. A session mid-teach has no answered
  // total yet, and "not started yet" would be a lie about a run you're in the
  // middle of — so when there's no progress the card just names the run.
  const answered =
    progress && progress.done > 0
      ? progress.total !== null
        ? `${progress.done} of ${progress.total} answered`
        : `${progress.done} answered`
      : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="min-w-0">
          <p className="mb-1.5 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
            Where you left off
          </p>
          <p className="text-[15px]">
            {what}
            {answered ? (
              <>
                {" · "}
                <span className="text-text-muted">{answered}</span>
              </>
            ) : null}
          </p>
          {startedAt && now ? (
            <p className="mt-1 max-w-[46ch] text-xs text-text-muted">
              Started {ago(startedAt, now)}.
            </p>
          ) : null}
        </div>
        <div className="flex flex-none items-center gap-2">
          <Btn sel onClick={onContinue}>
            Continue {noun}
          </Btn>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <Hint>Everything you answered is saved.</Hint>
        {/* One click, no dialog — see the header. */}
        <SmallBtn onClick={onDiscard}>Discard this {noun} ✕</SmallBtn>
      </div>
    </Card>
  );
}
