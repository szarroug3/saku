// "How much you've covered": the coverage bar with its tally and the sky's
// totals, in one panel. Tracked as SAK-336. The home shows it under the sky;
// an Atlas shelf shows the same panel for its own collection.

import { CoverageBar } from "@/sky/components/coverage-bar";
import { StandingLegend } from "@/sky/components/standing-legend";
import type { CoverageCounts } from "@/sky/lib/coverage";
import { STANDING_ORDER, type Standing } from "@/sky/lib/standing";

export interface CoveragePanelProps {
  counts: CoverageCounts;
  /** The whole collection the bar is drawn against. */
  total: number;
  /** The line beside the title: "32 stars · 10 constellations". */
  summary?: string;
  /** What the bar is a bar of, for assistive tech. */
  label: string;
  title?: string;
  note?: string;
  className?: string;
}

export function CoveragePanel({ counts, total, summary, label, title = "How much you've covered", note, className = "" }: CoveragePanelProps) {
  const present = STANDING_ORDER.filter((s): s is Standing => (counts[s] ?? 0) > 0 && s !== "not-seen");
  return (
    <section className={`rounded-2xl border border-sky-line bg-sky-card p-5 font-sky-ui text-sky-ink ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-muted">{title}</h2>
        {summary && <span className="text-[13px] text-sky-muted">{summary}</span>}
      </div>
      <CoverageBar className="mt-3 h-3" counts={counts} total={total} label={label} />
      <StandingLegend className="mt-4 flex-col !gap-y-2 text-[15px]" standings={present} counts={counts} />
      {note && <p className="mt-4 max-w-[52ch] text-[14px] leading-relaxed text-sky-muted">{note}</p>}
    </section>
  );
}
