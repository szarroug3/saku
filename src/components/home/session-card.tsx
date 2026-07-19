"use client";

// The session you left — and NOTHING when there isn't one.
//
// NO CONFIRM DIALOG, EVER
// =======================
// This card is what makes that affordable. Leaving mid-session costs you
// nothing because every answer was written to disk as you gave it (see
// `saveNow` in quiz-session.tsx), so there is no unsaved work to warn about
// and nothing to be sure about. You just come back and press Continue.
//
// It never expires. A session ends when you finish it or discard it, not when
// it gets old.
//
// CONTINUE AND RESTART, AND WHY NEITHER MOVES
// ===========================================
// Both buttons are always here, in the same order, at the same place. What
// changes after you've been away a day is which one is emphasised, and a
// sentence appears saying why. That is the whole mechanic:
//
//   - it swaps ONCE, at one threshold, and never swaps back mid-session
//   - the buttons don't appear, disappear, or reorder, so muscle memory holds
//     and the app never moves the thing you were reaching for
//   - Restart is the same operation as Recent's Rerun — replay the set as it
//     was — so it needs no explaining of its own
//
// The threshold is BORROWED, not invented: `COLD_AFTER_MS` is the same one day
// the scoring model already has an opinion about. It earns no setting. A
// number the user has to think about, to control a nudge, would be a worse app
// than a number that came from somewhere they already trust.

import { Btn, Card, Hint, SmallBtn } from "@/components/ui";
import { isCold, type StudySession } from "@/lib/session";

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

function where(session: StudySession, now: number): string {
  const round = `round ${session.round}`;
  switch (session.phase) {
    case "teaching":
      return "not started yet";
    case "drilling":
      return `${round} · in progress`;
    case "round-complete":
      return `${round} · done`;
    case "resting":
      return session.restUntil && session.restUntil > now
        ? `resting before round ${session.round + 1}`
        : `ready for round ${session.round + 1}`;
    case "complete":
      return "finished, not saved yet";
  }
}

export function SessionCard({
  session,
  /** Passed in rather than read here: a component that reads the clock during
   * render can't be server-rendered without the markup disagreeing with the
   * client a moment later. */
  now,
  onContinue,
  onRestart,
  onDiscard,
}: {
  session: StudySession;
  now: number;
  onContinue: () => void;
  onRestart: () => void;
  onDiscard: () => void;
}) {
  const cold = isCold(session, now);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="min-w-0">
          <p className="mb-1.5 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
            Where you left off
          </p>
          <p className="text-[15px]">
            {session.facts.length} item
            {session.facts.length === 1 ? "" : "s"} ·{" "}
            <span className="text-text-muted">{where(session, now)}</span>
          </p>
          {/* The sentence only exists when the emphasis has moved, and it says
              why it moved. With no swap there's nothing to explain, so it says
              nothing rather than narrating the app's mood at you. */}
          <p className="mt-1 max-w-[46ch] text-xs text-text-muted">
            {cold
              ? `You were last here ${ago(session.lastActiveAt, now)}. Starting it over asks you the whole set cold, which is the part that's had time to fade.`
              : `Last answer ${ago(session.lastActiveAt, now)}.`}
          </p>
        </div>
        {/* Fixed order, fixed place. Only `sel` moves. */}
        <div className="flex flex-none items-center gap-2">
          <Btn sel={!cold} onClick={onContinue}>
            Continue session
          </Btn>
          <Btn sel={cold} onClick={onRestart}>
            Restart
          </Btn>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <Hint>Everything you answered is saved.</Hint>
        {/* One click, no dialog. Discarding a session you deliberately clicked
            Discard on is not a surprise, and the app has no confirm dialogs. */}
        <SmallBtn onClick={onDiscard}>Discard this session ✕</SmallBtn>
      </div>
    </Card>
  );
}
