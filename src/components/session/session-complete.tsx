"use client";

// Finishing for good. The screen the "Complete session" button never had.
//
// This one IS allowed to show results — it is not the rest screen and the
// reasoning that empties that one doesn't reach here. Nothing follows this
// screen, so there is nothing left to rehearse FOR.
//
// The sentence compares your LAST round's first-try count to your FIRST
// round's, which is the only comparison the loop can honestly make: both are
// the same set, asked cold-ish and asked warm. It says nothing when there's
// only one round, because then there is no comparison and inventing one would
// be the app talking for the sake of talking.

import { Btn, Card, Hint, SmallBtn } from "@/components/ui";
import type { StudySession } from "@/lib/session";

function story(session: StudySession): string {
  const rounds = session.rounds;
  if (!rounds.length) return "Nothing answered.";
  const n = rounds.length;
  const last = rounds[n - 1];
  const first = rounds[0];
  const many = `${n} round${n === 1 ? "" : "s"} of the same ${session.facts.length}.`;
  if (n === 1) return `${many} You finished on ${last.firstTry} right first try.`;
  if (last.firstTry === first.firstTry) {
    return `${many} You finished on ${last.firstTry} right first try, the same as you started.`;
  }
  const dir = last.firstTry > first.firstTry ? "up" : "down";
  return `${many} You finished on ${last.firstTry} right first try, ${dir} from ${first.firstTry}.`;
}

export function SessionComplete({
  session,
  onRerun,
  onDone,
}: {
  session: StudySession;
  onRerun: () => void;
  onDone: () => void;
}) {
  const last = session.rounds[session.rounds.length - 1];
  const right = last?.firstTry ?? 0;
  const rest = Math.max(0, (last?.total ?? 0) - right);

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

        <div className="mt-5.5 flex justify-center gap-2">
          {/* Rerun is the same operation Recent's Rerun is: replay the session
              as it was, same set, fresh rounds. */}
          <SmallBtn onClick={onRerun}>Rerun it now</SmallBtn>
          <Btn autoFocus go onClick={onDone}>
            Done
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
