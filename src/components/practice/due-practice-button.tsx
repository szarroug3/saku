"use client";

// "Practice what's due" — the one-click shortcut above the query builder.
//
// The builder below (scope, status, date, kind, mode, length) is for someone
// who wants to slice their knowledge base on purpose. Most visits aren't that:
// a learner with a handful of items just wants "give me what's due", and today
// that means configuring the same five knobs every single time — Scope
// "Everything I know", Status "Shaky/Getting there/Slipping", Start.
//
// This button skips the builder entirely and hands Start the exact same pool a
// due-shaped query would name: `dueFacts` (selection.ts) reads the SAME
// `status()` split budget.ts and the Library's drill already read off the
// scoring model, over the SAME "everything I know" pool `resolve()` computes
// for the Scope buttons below. It is not a second definition of "due" — it is
// the existing one, run early and pre-clicked.

import { Info } from "@/components/ui";

export function DuePracticeButton({
  count,
  onStart,
}: {
  /** How many facts are due right now — dueFacts(...).length, computed by the
   * caller so this component never re-derives the model. */
  count: number;
  onStart: () => void;
}) {
  const disabled = count === 0;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2.5 border-b border-border pb-6">
      <button
        type="button"
        disabled={disabled}
        onClick={onStart}
        suppressHydrationWarning
        className="cursor-pointer rounded-lg bg-text px-4 py-2 text-sm font-semibold text-bg disabled:cursor-default disabled:opacity-40"
      >
        Practice what&apos;s due
      </button>
      <span
        suppressHydrationWarning
        className="text-[13px] text-text-muted"
      >
        {disabled
          ? "Nothing is due right now."
          : `${count} due for review right now.`}
      </span>
      <Info>
        &ldquo;Due&rdquo; means it&apos;s time to review this again, based on
        how well and how recently you&apos;ve remembered it before. The app
        tracks this per fact instead of a fixed schedule: something you
        answer well drifts out of Due for longer, something shaky comes back
        sooner.
      </Info>
    </div>
  );
}
