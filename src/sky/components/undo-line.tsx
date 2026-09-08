// The one way the Sky says what it just did and offers it back (SAK-364).
// The Observatory said "Removed 日 · Undo" and Practice said "Left out 日.
// Put it back" and "Put back all 3": the same idea in two voices.
//
// The shape: what happened, a period, the way back. A second way back, when
// there is more than one thing to take back, follows after a middot.

import type { ReactNode } from "react";

export interface UndoLineProps {
  /** What happened, with no closing punctuation: "Removed 日". */
  what: ReactNode;
  /** The way back. "Undo" for the last thing you did; its own verb for a
   * line that stands after the moment has passed ("Put them back"). */
  label?: string;
  onUndo: () => void;
  /** A second way back, for the rest of what is out. */
  also?: { label: string; onClick: () => void };
  className?: string;
}

export function UndoLine({ what, label = "Undo", onUndo, also, className = "" }: UndoLineProps) {
  return (
    <p className={`text-[12px] text-sky-muted ${className}`.trim()}>
      {what}.{" "}
      <button type="button" className="underline hover:text-sky-ink" onClick={onUndo}>{label}</button>
      {also && <> · <button type="button" className="underline hover:text-sky-ink" onClick={also.onClick}>{also.label}</button></>}
    </p>
  );
}
