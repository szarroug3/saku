// The one way the Sky asks before doing something the learner cannot take
// back (SAK-364). Sessions and Account each carried a near-identical copy of
// this row, and Practice's "Delete" fired with no ask at all.
//
// THE RULE: ask before anything that cannot be got back, and only then. A
// saved recipe, a session's answers, every bit of progress: all gone for
// good, so all asked for. Clearing a mix-up is not in that set, because the
// pair comes back the next time the two get swapped.
//
// The shape is always the same: a line saying what happens, the verb in
// coral, and the way out beside it. Sam's wording from the sessions page,
// which was the one that read best, and "Keep it" unless the caller has a
// better name for backing out.
//
// THE LINE IS OPTIONAL (SAK-443). A verb that says the whole thing by itself,
// "Delete it forever", leaves the sentence beside it with nothing to add, and
// a row that says the same thing twice reads as a warning being laid on
// thick. The line stays wherever it carries something the button cannot: what
// leaves with the thing, how much of it there is.

import { SkyButton } from "@/sky/components/sky-button";
import type { ReactNode } from "react";

interface InlineAskProps {
  /** What happens, in a line: "Its answers leave your schedule." Left out
   * when the verb already says it. */
  what?: ReactNode;
  /** The verb on the coral button: "Forget it", "Delete everything". */
  confirm: string;
  /** The verb while it runs: "Forgetting…". */
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  /** Backs out. */
  onKeep: () => void;
  /** What backing out is called, when "Keep it" is not what it does. The one
   * ask that needs this is the quiz's (SAK-444): backing out of starting a
   * new run means going back to the one you had, and "Keep it" beside "Start
   * and replace" reads as keeping the new one. Everything else keeps the
   * default, which is the wording SAK-364 settled on. */
  keepLabel?: string;
  className?: string;
}

export function InlineAsk({ what, confirm, busyLabel, busy = false, onConfirm, onKeep, keepLabel = "Keep it", className = "" }: InlineAskProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {what && <span className="text-[13px] text-sky-ink/90">{what}</span>}
      <SkyButton variant="coral" disabled={busy} onClick={onConfirm}>{busy && busyLabel ? busyLabel : confirm}</SkyButton>
      <SkyButton variant="outline" disabled={busy} onClick={onKeep}>{keepLabel}</SkyButton>
    </div>
  );
}
