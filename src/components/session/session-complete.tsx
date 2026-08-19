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

import { useMemo, useState } from "react";

import {
  boxKeysForFacts,
  factsFromPickedBoxes,
  missedBoxKeysForFacts,
  type BoxKey,
} from "@/components/results/word-table";
import { Board } from "@/components/results/triage-board";
import { ResultsCard } from "@/components/results/results-card";
import {
  historyBefore,
  runFactsFromSession,
  subsetStats,
  summarize,
} from "@/components/results/summary";
import { Btn, Card, Hint, SmallBtn } from "@/components/ui";
import { entryDisplayLabel } from "@/components/results/entry-display-label";
import { isTaughtSession, type StudySession } from "@/lib/session";
import { useHistory } from "@/lib/use-history";
import type { EntryId, FactId } from "@/types";

import { retryButtonLabel } from "./retry-grouping";

/** The needs-work/solid/all box sets a board section needs, for one fact set
 * against one stats object — the same split round-complete.tsx computes,
 * shared here since session-complete needs it twice (Path A over
 * `session.teach`, Path B over `session.facts`). */
function boardBoxes(facts: FactId[], notAnswered: FactId[], stats: ReturnType<typeof subsetStats>) {
  const allBoxes = new Set(boxKeysForFacts(facts, stats));
  const needsWorkBoxes = new Set(missedBoxKeysForFacts(facts, stats));
  const notAnsweredBoxes = new Set(boxKeysForFacts(notAnswered, stats));
  const solidBoxes = new Set(
    [...allBoxes].filter((b) => !needsWorkBoxes.has(b) && !notAnsweredBoxes.has(b)),
  );
  return { allBoxes, needsWorkBoxes, solidBoxes };
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
  const items = session.facts.length;
  const taught = isTaughtSession(session);
  const { history } = useHistory();
  const displayEntry = (entry: EntryId, fact: FactId): string =>
    entryDisplayLabel(entry, fact, history);
  const prior = useMemo(
    () => historyBefore(history, session.startedAt),
    [history, session.startedAt],
  );

  // PATH A's picker state. Declared unconditionally — hooks can't be
  // conditional — even though Path B never reads it for its OWN buttons
  // (its board is still the same selectable Board, just nothing downstream
  // acts on the pick — see the render below). Starts EMPTY on purpose: unlike
  // a retry's outstanding misses, quizzing again here is a deliberate pick
  // every time, not a pre-ticked default, which is what the disabled "Select
  // some items above to quiz" note below is for.
  const [picked, setPicked] = useState<Set<BoxKey>>(() => new Set());
  const toggle = (box: BoxKey) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(box)) next.add(box);
      return next;
    });
  const setVisible = (boxes: Set<BoxKey>, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const b of boxes) if (on) next.add(b);
        else next.delete(b);
      return next;
    });
  // Statuses are read from `totalStats` (every round merged), not
  // `roundStats` — by the time this screen can render, the last round has
  // already closed and reset `roundStats` to `{}` (see closeRound in
  // quiz-session.tsx), so `totalStats` is the only place the whole session's
  // per-item outcome still lives.
  const pickedList = factsFromPickedBoxes(picked, session.teach);

  // The SAME ring/headline/counts sentence and needs-work/solid board every
  // results screen renders (results-card.tsx, triage-board.tsx, summary.ts) —
  // Path A over `session.teach`, Path B over `session.facts` (its `teach` is
  // empty). `subsetStats` pads to EVERY fact in that set, real entry or a
  // zero stub — a lesson item the quiz never reached at all still belongs on
  // the board, reading "not shown", not silently missing from it. `totalStats`
  // can carry review material beyond this path's own set, which is exactly
  // what this narrows away.
  const pathFacts = taught ? session.teach : session.facts;
  const stats = useMemo(
    () => subsetStats(session.totalStats, pathFacts),
    [session.totalStats, pathFacts],
  );
  const run = useMemo(() => runFactsFromSession(stats), [stats]);
  const summary = useMemo(
    () => summarize(run, stats, prior, []),
    [run, stats, prior],
  );
  const { allBoxes, needsWorkBoxes, solidBoxes } = boardBoxes(
    run.facts,
    run.notAnswered,
    stats,
  );

  return (
    <>
      <Card className="px-5 pb-[30px] pt-[38px]">
        <h1 className="text-center text-[26px] font-light tracking-[-0.3px]">
          Session complete
        </h1>

        <div className="mt-5.5">
          <ResultsCard
            pct={run.pct}
            headline={summary.headline}
            detail={summary.detail}
            counts={summary.counts}
          />
        </div>

        {needsWorkBoxes.size ? (
          <div className="mt-3.5 border-t border-border pt-3">
            <Board
              label="Needs work"
              facts={run.facts}
              stats={stats}
              visibleBoxes={needsWorkBoxes}
              selected={picked}
              onToggle={toggle}
              onSetVisible={setVisible}
              displayEntry={displayEntry}
            />
          </div>
        ) : null}
        {solidBoxes.size ? (
          <div className="mt-3.5 border-t border-border pt-3">
            <Board
              label="Solid"
              facts={run.facts}
              stats={stats}
              visibleBoxes={solidBoxes}
              solidTone
              selected={picked}
              onToggle={toggle}
              onSetVisible={setVisible}
              displayEntry={displayEntry}
            />
          </div>
        ) : null}

        {taught ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <SmallBtn
              sel
              autoFocus
              disabled={!pickedList.length}
              onClick={() => onQuizAgain(pickedList, [...picked])}
            >
              {retryButtonLabel(pickedList.length)}
            </SmallBtn>
            {!needsWorkBoxes.size ? (
              <SmallBtn onClick={() => onQuizAgain(session.teach, [...allBoxes])}>
                Retry all
              </SmallBtn>
            ) : null}
            {pickedList.length ? null : (
              <Hint>Select some items above to quiz.</Hint>
            )}
          </div>
        ) : (
          <>
            <p className="mx-auto mt-3.5 max-w-[36ch] text-[13px] text-text-muted">
              Know {items === 1 ? "this" : "these"} already, or want the
              lesson?
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
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
