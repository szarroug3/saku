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
// out of here marked known. That is never allowed to happen quietly again, so
// finishing now asks: the exact "I already know this" claim the Learn card
// itself offers, styled the SAME plain way it is there, or the forward action
// that just moves on without claiming anything — styled `go`, the same accent
// "Start"/"Continue session" gets on that same card. Same pairing, same
// weighting, just reached from the other end of the run.

import { Btn, Card, Hint, SmallBtn } from "@/components/ui";
import type { StudySession } from "@/lib/session";

function story(session: StudySession): string {
  const rounds = session.rounds;
  if (!rounds.length) return "Nothing answered.";
  const n = rounds.length;
  const last = rounds[n - 1];
  const first = rounds[0];
  const many = `${n} round${n === 1 ? "" : "s"} of the same ${session.facts.length}.`;
  if (n === 1) return `${many} You finished on ${last.correct} correct.`;
  if (last.correct === first.correct) {
    return `${many} You finished on ${last.correct} correct, the same as you started.`;
  }
  const dir = last.correct > first.correct ? "up" : "down";
  return `${many} You finished on ${last.correct} correct, ${dir} from ${first.correct}.`;
}

export function SessionComplete({
  session,
  onRerun,
  onMarkKnown,
  onGoToLesson,
}: {
  session: StudySession;
  onRerun: () => void;
  /** "I already know these" over this session's material — the exact Learn-card
   * claim mechanism, reached from here instead. */
  onMarkKnown: () => void;
  /** Nothing is claimed; the forward action that just leaves. Named for what a
   * "Quiz me" run needs it to mean: not confirmed known, so the lesson (or a
   * re-quiz) is still where Learn offers it. */
  onGoToLesson: () => void;
}) {
  const last = session.rounds[session.rounds.length - 1];
  const right = last?.correct ?? 0;
  const rest = Math.max(0, (last?.total ?? 0) - right);
  const items = session.facts.length;

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

        <p className="mx-auto mt-5.5 max-w-[36ch] text-[13px] text-text-muted">
          Know {items === 1 ? "this" : "these"} already, or want the lesson?
        </p>
        <div className="mt-2.5 flex flex-wrap justify-center gap-2">
          {/* Rerun is the same operation Recent's Rerun is: replay the session
              as it was, same set, fresh rounds. */}
          <SmallBtn onClick={onRerun}>Quiz again</SmallBtn>
          <Btn onClick={onMarkKnown}>
            I already know {items === 1 ? "this" : `these ${items}`}
          </Btn>
          <Btn autoFocus go onClick={onGoToLesson}>
            Take me to the lesson
          </Btn>
        </div>
      </Card>

      <Card className="px-[15px] py-[13px]">
        <Hint>
          Saved in <b>Recent sessions</b>, and you can run this exact set again
          any time.
        </Hint>
      </Card>
    </>
  );
}
