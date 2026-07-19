"use client";

// The break. A clock and nothing else.
//
// ========================= THE RULE FOR THIS FILE =========================
// The point of the rest screen is that you are NOT studying. If the content is
// in front of you right up to the second you're asked again, it isn't a rest —
// it's a lesson with a countdown on it, and the spacing you just paid five
// minutes for buys you nothing.
//
// So the test for anything you are about to add here is one question:
//   COULD THEY REHEARSE WITH IT?
// If yes, it cannot be on this screen. That rules out, and has already ruled
// out: the round's item list, the misses, the answers, the round summary, the
// accuracy, a preview of what's next, and the "you'll be asked X, Y, Z" line
// that felt so helpful in the first draft. An earlier version of this screen
// was the nicest-looking one in the set and it defeated the entire feature.
//
// What's left is: how long (the countdown and the wall-clock return time), and
// the two ways out. That's the screen.
//
// (The SESSION-COMPLETE screen may show results — it's a different screen,
// after a different decision, and nothing follows it. Don't reason from it
// back to this one.)
// ==========================================================================
//
// THE COUNTDOWN IS A READ, NOT A PROCESS
// ======================================
// `restUntil` is a timestamp written once when the round completed. The
// interval below re-renders the digits; it does not own them. Kill the tab,
// kill the browser, come back in three days — the countdown recomputes from
// the same stored number and says "ready", because it never had any state to
// lose. A rest timer that broke when you closed the tab would be a bug. This
// one cannot have it: leaving during a rest is free, because nothing is in
// flight.

import { Btn, Card, Hint, SmallBtn } from "@/components/ui";
import {
  formatCountdown,
  formatReturnTime,
  restLeftMs,
  type StudySession,
} from "@/lib/session";

export function RestScreen({
  session,
  now,
  onStart,
  onDone,
  onComplete,
}: {
  session: StudySession;
  /** The ticking clock, owned by the route so this and the bar above it agree.
   * Null before mount — see use-now.ts. The truth is `session.restUntil`; this
   * is only how often we look at it. */
  now: number | null;
  onStart: () => void;
  onDone: () => void;
  onComplete: () => void;
}) {
  // Before the clock has been read, show the countdown rather than the Start
  // button: claiming "ready" and being wrong would skip someone's rest, where
  // showing a stale second is invisible and self-corrects on the next tick.
  const left = now === null ? Infinity : restLeftMs(session, now);
  const ready = left === 0;
  const nextRound = session.round + 1;

  return (
    <>
      <Card className="px-[18px] pb-[46px] pt-[54px] text-center">
        {ready ? (
          <>
            <p className="mb-5 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
              Round {nextRound}
            </p>
            <p className="text-[26px] font-light">Ready when you are.</p>
            <div className="mt-6 flex justify-center gap-2">
              <SmallBtn onClick={onDone}>Done for now</SmallBtn>
              <SmallBtn onClick={onComplete}>Complete session now</SmallBtn>
              <Btn autoFocus go onClick={onStart}>
                Start round {nextRound}
              </Btn>
            </div>
          </>
        ) : (
          <>
            <p className="mb-5 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
              Until round {nextRound}
            </p>
            {/* The only number on the screen. Blank for the one frame before
                the clock is read — a placeholder digit would be a lie, and
                this is the one number the screen exists to tell the truth
                about. */}
            <p className="text-[76px] font-extralight leading-none tracking-[-2.5px] tabular-nums">
              {Number.isFinite(left) ? formatCountdown(left) : " "}
            </p>
            {session.restUntil !== null && (
              <p className="mt-4.5 text-[13px] text-text-muted">
                Come back at {formatReturnTime(session.restUntil)}
              </p>
            )}
            <div className="mt-6 flex justify-center gap-2">
              <SmallBtn onClick={onDone}>Done for now</SmallBtn>
              <SmallBtn onClick={onComplete}>Complete session now</SmallBtn>
              {/* Skipping is yours to do. The app doesn't hide it and doesn't
                  argue with you about it. */}
              <SmallBtn onClick={onStart}>Start now →</SmallBtn>
            </div>
          </>
        )}
      </Card>

      <Card className="px-[15px] py-[13px]">
        <Hint>
          Spacing works best when you do the rests, but you can complete early if
          you need to.
        </Hint>
        <Hint>
          Reloading or closing the page will not lose your progress.
        </Hint>
      </Card>
    </>
  );
}
