// The two pieces of furniture every new lesson section is built out of: the
// panel, and the row that pairs two of them.
//
// ONE PANEL, SO THE SECTIONS MATCH
// ================================
// The lesson's reference sections are nested inside the walk's page rather than
// sitting on it, so they wear NESTED-panel material — `--panel`, the smaller
// radius, the tighter padding — which is the material "how it's written" and the
// readings section already use. Every section added by the redesign uses this
// component rather than repeating the class string, because a paired row whose
// two halves have different padding reads as two unrelated boxes.
//
// THE FULL-WIDTH FALLBACK IS A LAYOUT DECISION, SO IT LIVES IN THE LAYOUT
// ======================================================================
// Both new paired rows — the kanji's parts/lookalikes, the word's readings/
// sentence — have the same rule: when only ONE half has content, that half takes
// the whole width, and when NEITHER does the row is absent entirely. That rule
// is not about kanji or about words; it is about a row of two, and it is worth
// writing once where it can be tested once.
//
// It matters because the paired state is the RARE one. 16 of 2,136 kanji have
// both parts and a known lookalike; 1,728 have neither. A half-width card beside
// a permanent hole would be the common path, and a hole is not a design.
//
// The grid itself is the Library's paired-row idiom verbatim — see the kana and
// kanji branches of the entry page. `[&>*]:h-full` is what makes the two halves
// share a height instead of ending at their own content; `[&>*]:mb-0` cancels
// the bottom margin a stretched item would otherwise end short of its
// neighbour with; and below 860px the grid becomes one column, where stretching
// means nothing and heights go back to content.

import type { ReactNode } from "react";

export function LessonPanel({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-border bg-panel px-3.5 py-3 ${className}`}
    >
      <p className="text-[13px] font-medium">{title}</p>
      <div className="mt-2 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

/**
 * Two sections side by side — or one of them full width, or nothing.
 *
 * `wide` takes the 1.45fr half when the two are unequal (a formula and its
 * worked examples, a stroke chart). `even` splits them down the middle instead,
 * for the rows whose halves carry the same weight.
 *
 * A null half is ABSENT, not empty: the surviving half is returned on its own,
 * unwrapped, so it is a plain full-width block rather than a one-column grid
 * pretending to be a pair.
 */
export function PairedRow({
  wide,
  narrow,
  even = false,
}: {
  wide: ReactNode | null;
  narrow: ReactNode | null;
  even?: boolean;
}) {
  if (!wide && !narrow) return null;
  if (!narrow) return <>{wide}</>;
  if (!wide) return <>{narrow}</>;
  return (
    <div
      className={`grid ${
        even ? "grid-cols-2" : "grid-cols-[1.45fr_1fr]"
      } gap-3.5 max-[860px]:grid-cols-1 [&>*]:mb-0 [&>*]:h-full`}
    >
      {wide}
      {narrow}
    </div>
  );
}
