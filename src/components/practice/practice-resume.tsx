"use client";

// The practice quiz you left running — and NOTHING when there isn't one.
//
// A Practice run is a ONE-OFF QUIZ (startQuiz), not the teach → drill → rest
// session loop the lesson cards and the Library Drill use. It lives in the
// provider's `active` leg with `session` null, and its runtime — the deck, your
// position in it, every card's state — is snapshotted to localStorage as you
// answer (saveNow). So Continue re-enters the very card you left on rather than
// re-asking the set from the top, which is why this card offers Continue and
// not Restart: there is nothing to restart, only somewhere to go back to.
//
// It shows ONLY while such a quiz is in progress. A lesson session (which the
// lesson cards on Home resume) is a different thing and keeps `session` set, so
// the page that renders this passes `active && !session` and this card never
// stands in for a lesson.
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
  what,
  progress,
  /** When Start was pressed. Optional: a quiz snapshotted before this field
   * existed restores without it, and the "started …" line is then omitted
   * rather than inventing a time. */
  startedAt,
  /** Passed in rather than read here so the card can be rendered without the
   * markup disagreeing with the client a moment later. Null until mounted. */
  now,
  onContinue,
  onDiscard,
}: {
  what: string;
  progress: QuizProgress | null;
  startedAt?: number;
  now: number | null;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const answered = !progress
    ? "not started yet"
    : progress.total !== null
      ? `${progress.done} of ${progress.total} answered`
      : `${progress.done} answered`;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="min-w-0">
          <p className="mb-1.5 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
            Where you left off
          </p>
          <p className="text-[15px]">
            {what} · <span className="text-text-muted">{answered}</span>
          </p>
          {startedAt && now ? (
            <p className="mt-1 max-w-[46ch] text-xs text-text-muted">
              Started {ago(startedAt, now)}.
            </p>
          ) : null}
        </div>
        <div className="flex flex-none items-center gap-2">
          <Btn sel onClick={onContinue}>
            Continue quiz
          </Btn>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <Hint>Everything you answered is saved.</Hint>
        {/* One click, no dialog — see the header. */}
        <SmallBtn onClick={onDiscard}>Discard this quiz ✕</SmallBtn>
      </div>
    </Card>
  );
}
