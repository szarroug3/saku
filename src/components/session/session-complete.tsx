"use client";

// Finishing for good. The screen the "Complete session" button never had.
//
// This one IS allowed to show results — it is not the rest screen and the
// reasoning that empties that one doesn't reach here. Nothing follows this
// screen, so there is nothing left to rehearse FOR.
//
// The sentence compares your LAST round's correct count to your FIRST
// round's, which is the only comparison the loop can honestly make: both are
// the same set, asked cold-ish and asked warm. It says nothing when there's
// only one round, because then there is no comparison and inventing one would
// be the app talking for the sake of talking.
//
// THE CHOICE (SAK-52). A single "Complete session" button used to end the run
// AND silently claim its material known, whatever the quiz said — "Quiz me"
// missed once and never taught, or a real lesson scored 1 of 5, both walked
// out of here marked known. That is never allowed to happen quietly again.
//
// TWO SCREENS, NOT ONE, AND THEY DO NOT SHARE CONTROLS (SAK-52, later round).
// =============================================================================
// This used to render every control unconditionally — Quiz again, "I already
// know these" AND "Take me to the lesson" all at once, on every session. That
// crossed two genuinely different endings into one screen:
//
//   PATH A — a lesson that TAUGHT before it quizzed (`session.teach` non-
//   empty). Nothing here may claim OR discard: the learner already sat through
//   the lesson, so "know these already, or want the lesson?" is a question
//   about material they just finished being taught, which makes no sense to
//   ask. The only forward action is asking again — Quiz again, over whichever
//   of the taught items the learner picks, greyed out with a note until they
//   pick at least one.
//
//   PATH B — a "Quiz me" run that skipped the lesson (`session.teach` empty).
//   This is the one the ORIGINAL "I already know this" / "Start" pairing was
//   written for (see the comment that used to live here): the exact "I already
//   know this" claim the Learn card itself offers, styled the SAME plain way
//   it is there, or the forward action that just moves on without claiming
//   anything — styled `go`, the same accent "Start"/"Continue session" gets on
//   that same card.
//
// `isTaughtSession` (session.ts) is the discriminator, and it is the SAME
// signal `initialSessionPhase` already keys "teaching" vs "starting" on —
// `session.origin` does not distinguish the two paths (both are "lesson").
//
// PATH A'S "QUIZ AGAIN" IS THE SAME MECHANISM A RETRY IS, NOT A REPLAY.
// ======================================================================
// It used to call `startSession(facts, teach, what)` — a full session restart
// over the ORIGINAL set, not "quiz what I just picked". Now it hands the
// learner's picked subset up to the exact same `retryLeg` a round-complete
// retry uses (see RoundComplete's `onRetry` in round-complete.tsx): one leg,
// forced full coverage over exactly the picked facts, landing back at the
// round fork when it finishes. One retry mechanism, reached from two screens.
//
// `correct` alone CANNOT tell "the same as you started" from "the same
// destination by a rockier road" (SAK-21): it is everCorrect, a monotonic OR
// over the round's retry legs (see RoundSummary and drill-stats.ts), so a
// round with a miss that got recovered before the round ended reads
// identically to a round with no miss at all. `missed` (facts that took at
// least one miss this round) is what actually distinguishes the two, and it
// is already on RoundSummary — so the comparison has to agree on BOTH counts
// before it can honestly call two rounds the same.

import { useState } from "react";

import {
  factsFromPickedBoxes,
  roundFormCounts,
  roundFormsByOutcome,
  WordTable,
  type BoxKey,
} from "@/components/results/word-table";
import { Btn, Card, Hint } from "@/components/ui";
import { isTaughtSession, sameAsStarted, type StudySession } from "@/lib/session";
import type { FactId } from "@/types";

function story(session: StudySession): string {
  const rounds = session.rounds;
  if (!rounds.length) return "Nothing answered.";
  const n = rounds.length;
  const last = rounds[n - 1];
  const first = rounds[0];
  const many = `${n} round${n === 1 ? "" : "s"} of the same ${session.facts.length}.`;
  if (n === 1) return `${many} You finished on ${last.correct} correct.`;
  if (sameAsStarted(first, last)) {
    return `${many} You finished on ${last.correct} correct, the same as you started.`;
  }
  if (last.correct === first.correct) {
    // The tally matches but sameAsStarted said no — so `missed` differs: one
    // round needed a retry to land the same count the other landed clean.
    // Reusing "up/down from N correct" here would print a direction next to
    // the SAME number twice ("up from 5" under "5 correct"), which reads as
    // no change at all. Name the miss instead — the thing that actually
    // moved.
    const cleaner = last.missed < first.missed;
    const note =
      last.missed === 0
        ? "clean this time, no retries needed"
        : first.missed === 0
          ? `took ${last.missed} ${last.missed === 1 ? "retry" : "retries"} to get there, none needed at the start`
          : `${cleaner ? "fewer" : "more"} needed a retry (${last.missed}, vs ${first.missed} at the start)`;
    return `${many} You finished on ${last.correct} correct — ${note}.`;
  }
  const dir = last.correct > first.correct ? "up" : "down";
  return `${many} You finished on ${last.correct} correct, ${dir} from ${first.correct}.`;
}

export function SessionComplete({
  session,
  onQuizAgain,
  onMarkKnown,
  onGoToLesson,
}: {
  session: StudySession;
  /**
   * PATH A ONLY. Quiz just the picked subset of what was taught — the same
   * beginLeg-based mechanism RoundComplete's `onRetry` uses (see retryLeg in
   * quiz-session.tsx): one full-coverage leg over exactly these facts, landing
   * back at the round fork. Never called with an empty list — the button is
   * disabled until at least one item is picked.
   */
  onQuizAgain: (facts: FactId[], boxes: BoxKey[]) => void;
  /** PATH B ONLY. "I already know these" over this session's material — the
   * exact Learn-card claim mechanism, reached from here instead. */
  onMarkKnown: () => void;
  /** PATH B ONLY. Nothing is claimed; the forward action that just leaves.
   * Named for what a "Quiz me" run needs it to mean: not confirmed known, so
   * the lesson (or a re-quiz) is still where Learn offers it. */
  onGoToLesson: () => void;
}) {
  const last = session.rounds[session.rounds.length - 1];
  const right = last?.correct ?? 0;
  const rest = Math.max(0, (last?.total ?? 0) - right);
  const items = session.facts.length;
  const taught = isTaughtSession(session);

  // PATH A's picker state. Declared unconditionally — hooks can't be
  // conditional — even though Path B never reads it. Starts EMPTY on purpose:
  // unlike a retry's outstanding misses, quizzing again here is a deliberate
  // pick every time, not a pre-ticked default, which is what the disabled
  // "Select some items above to quiz" note below is for.
  const [picked, setPicked] = useState<Set<BoxKey>>(() => new Set());
  const toggle = (box: BoxKey) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(box)) next.add(box);
      return next;
    });
  // Statuses are read from `totalStats` (every round merged), not
  // `roundStats` — by the time this screen can render, the last round has
  // already closed and reset `roundStats` to `{}` (see closeRound in
  // quiz-session.tsx), so `totalStats` is the only place the whole session's
  // per-item outcome still lives.
  const pickedList = factsFromPickedBoxes(picked, session.teach);
  const { solid, needsWork, totalForms } = roundFormCounts(
    session.teach,
    session.totalStats,
  );

  // PATH B's results, read-only. Same shape as a practice quiz's own results
  // board (and RoundComplete's own breakdown) — form counts, then Needs work
  // before Solid — just with no picker: Path B's two forward actions (I
  // already know these / Take me to the lesson) act on the WHOLE batch, not a
  // per-item selection, so the cells here are informational only.
  const untaughtCounts = roundFormCounts(session.facts, session.totalStats);
  const { solid: untaughtSolidList, needsWork: untaughtNeedsWorkList } =
    roundFormsByOutcome(session.facts, session.totalStats);
  const untaughtSolidBoxes = new Set(untaughtSolidList);
  const untaughtNeedsWorkBoxes = new Set(untaughtNeedsWorkList);
  const noSelection = () => false;
  const noToggle = () => {};

  return (
    <>
      <Card className="px-5 pb-[30px] pt-[38px] text-center">
        <h1 className="text-[26px] font-light tracking-[-0.3px]">
          Session complete
        </h1>
        <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-text-muted">
          {story(session)}
        </p>

        {last ? (
          <div className="mx-auto mb-2 mt-5 flex h-1.5 max-w-[280px] overflow-hidden rounded-full bg-panel">
            {right > 0 ? (
              <span className="block h-full bg-success" style={{ flex: right }} />
            ) : null}
            {rest > 0 ? (
              <span className="block h-full bg-danger" style={{ flex: rest }} />
            ) : null}
          </div>
        ) : null}

        {taught ? (
          <>
            {/* `taught` already means `session.teach.length > 0` (that IS
                isTaughtSession's definition), so this branch always has at
                least one row to show. */}
            <div className="mt-5.5 text-left">
              <p className="mb-2 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
                {totalForms} form{totalForms === 1 ? "" : "s"} · {solid} solid
                · {needsWork} needs work
              </p>
              <WordTable
                facts={session.teach}
                stats={session.totalStats}
                isSelected={(box) => picked.has(box)}
                onToggle={toggle}
              />
            </div>
            <div className="mt-3.5 flex flex-col items-center gap-1.5">
              <Btn
                sel
                autoFocus
                disabled={!pickedList.length}
                className="disabled:cursor-default disabled:opacity-45"
                onClick={() => onQuizAgain(pickedList, [...picked])}
              >
                Quiz again
              </Btn>
              {pickedList.length ? null : (
                <Hint>Select some items above to quiz.</Hint>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mt-5.5 text-left">
              <p className="mb-2 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
                {untaughtCounts.totalForms} asked · {untaughtCounts.solid}{" "}
                solid · {untaughtCounts.needsWork} needs work
              </p>
              {untaughtNeedsWorkBoxes.size ? (
                <div className="border-t border-border pt-3">
                  <p className="text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
                    Needs work
                  </p>
                  <div className="mt-2">
                    <WordTable
                      facts={session.facts}
                      stats={session.totalStats}
                      showOnly={untaughtNeedsWorkBoxes}
                      isSelected={noSelection}
                      onToggle={noToggle}
                    />
                  </div>
                </div>
              ) : null}
              {untaughtSolidBoxes.size ? (
                <div className="mt-3.5 border-t border-border pt-3">
                  <p className="mb-2 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
                    Solid
                  </p>
                  <WordTable
                    facts={session.facts}
                    stats={session.totalStats}
                    showOnly={untaughtSolidBoxes}
                    solidTone
                    isSelected={noSelection}
                    onToggle={noToggle}
                  />
                </div>
              ) : null}
            </div>
            <p className="mx-auto mt-5.5 max-w-[36ch] text-[13px] text-text-muted">
              Know {items === 1 ? "this" : "these"} already, or want the
              lesson?
            </p>
            <div className="mt-2.5 flex flex-wrap justify-center gap-2">
              <Btn onClick={onMarkKnown}>
                I already know {items === 1 ? "this" : `these ${items}`}
              </Btn>
              <Btn autoFocus go onClick={onGoToLesson}>
                Take me to the lesson
              </Btn>
            </div>
          </>
        )}
      </Card>

      <Card className="px-[15px] py-[13px]">
        <Hint>
          {taught ? (
            <>
              Saved in <b>Recent sessions</b>.
            </>
          ) : (
            <>
              Saved in <b>Recent sessions</b>. <b>I already know these</b>{" "}
              claims anything you didn&apos;t actually answer — whatever you
              DID answer keeps its real result. <b>Take me to the lesson</b>{" "}
              claims and saves nothing, and reopens this exact set as a fresh
              lesson.
            </>
          )}
        </Hint>
      </Card>
    </>
  );
}
