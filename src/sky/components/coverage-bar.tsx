// The coverage bar: the stacked bar split by standing, in the palette the
// sky's stars and chips use. Tracked as SAK-298.
//
// Shown on the home as "How much you've covered" and at the top of every
// Atlas shelf. It takes counts and the size of the whole collection, renders
// proportionally, and carries no labels of its own: the caller pairs it with
// a headline ("31 of 2,104 kanji known") and a StandingLegend with the same
// counts, which is what keeps a coloured bar from being a bare coloured dot.
//
// Always drawn against the whole collection (see src/sky/lib/coverage.ts).
// A segment with a count is never lost: below one pixel it still draws at a
// hairline, so a learner's first three kanji show up on a bar of thousands.
// With no counts at all the track still draws, so an empty bar is a bar.

import { coverageSegments, type CoverageCounts } from "@/sky/lib/coverage";
import { STANDING } from "@/sky/lib/standing";

export interface CoverageBarProps {
  counts: CoverageCounts;
  /** The size of the whole collection. Required, on purpose. */
  total: number;
  /** What the bar is a bar of, for assistive tech: "kanji", "the whole sky". */
  label: string;
  /** Bar height class. Default h-3. */
  className?: string;
}

export function CoverageBar({ counts, total, label, className = "h-3" }: CoverageBarProps) {
  const { segments, untouched } = coverageSegments(counts, total);
  const seen = Math.max(0, total - untouched);
  return (
    <div
      role="img"
      aria-label={`${label}: ${seen} of ${total} seen${segments.map((s) => `, ${s.count} ${STANDING[s.standing].label}`).join("")}`}
      className={`flex w-full overflow-hidden rounded-full bg-sky-card-strong ${className}`}
      data-coverage-total={total}
    >
      {segments.map((s) => (
        <div
          key={s.standing}
          data-segment={s.standing}
          className={`h-full min-w-[2px] ${STANDING[s.standing].dot}`}
          style={{ width: `${s.share * 100}%` }}
        />
      ))}
    </div>
  );
}
