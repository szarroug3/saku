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
// coral, and "Keep it" beside it. Sam's wording from the sessions page, which
// was the one that read best.

import { SkyButton } from "@/sky/components/sky-button";
import type { ReactNode } from "react";

interface InlineAskProps {
  /** What happens, in a line: "Its answers leave your schedule." */
  what: ReactNode;
  /** The verb on the coral button: "Forget it", "Delete everything". */
  confirm: string;
  /** The verb while it runs: "Forgetting…". */
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  /** Backs out. The other button always says "Keep it". */
  onKeep: () => void;
  className?: string;
}

export function InlineAsk({ what, confirm, busyLabel, busy = false, onConfirm, onKeep, className = "" }: InlineAskProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <span className="text-[13px] text-sky-ink/90">{what}</span>
      <SkyButton variant="coral" disabled={busy} onClick={onConfirm}>{busy && busyLabel ? busyLabel : confirm}</SkyButton>
      <SkyButton variant="outline" disabled={busy} onClick={onKeep}>Keep it</SkyButton>
    </div>
  );
}
