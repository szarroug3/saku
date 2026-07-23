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

import { ConfigPreview } from "@/components/quiz/config-preview";
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

      {/* How the NEXT round will run, and one tap to change it. This does not
          break the rule at the top of this file: the rule bars anything you
          could REHEARSE with — the items, the answers, a preview of what's
          coming. Config is none of that. It is mode / direction / style /
          length, a statement of how you'll be asked, not of what — nothing to
          study off. Putting it here is what makes the config visible at a launch
          point that otherwise just resumes drilling with settings you can't see.
          The re-snapshot per round already lands any change on the next round,
          so editing during the break is the natural time to do it. */}
      <Card className="px-[15px] py-[13px]">
        <ConfigPreview />
      </Card>

      <Card className="px-[15px] py-[13px]">
        {/* Each hint gets its own block. Hint is a <span> (see ui.tsx), so two
            of them side by side ran together into "…if you need to.Your
            finished rounds are saved." — reported in the beginner audit at both
            the round-1→2 and round-2→3 breaks. Wrapped here rather than turning
            Hint into a block, because Hint sits inline inside sentences
            elsewhere and this card is the only place two of them stack. */}
        <p>
          <Hint>
            Spacing works best when you do the rests, but you can complete early
            if you need to.
          </Hint>
        </p>
        {/* THIS SENTENCE IS NOW TRUE, AND IT WAS NOT.
            It used to describe the localStorage snapshot only: the session
            resumed, so "progress" in the sense of "where you are in the loop"
            survived — but nothing you had ANSWERED existed anywhere durable
            until you completed the whole session, and a learner reads this as
            "my answers are safe". A session that never completed took every
            answer in it with it.
            Reaching this screen means the round just closed, and closing a
            round writes it (see closeRound in quiz-session.tsx). So by the time
            anyone can read this, the work it is talking about is on disk. The
            first clause says which part is saved, because "your progress" on
            its own is the word that did the lying. */}
        <p className="mt-1.5">
          <Hint>
            Your finished rounds are saved. Reloading or closing the page will
            not lose your progress.
          </Hint>
        </p>
      </Card>
    </>
  );
}
