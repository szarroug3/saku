// A panel on a sky page: the frosted card (see .sky-frost in sky-wash.css:
// the wash's own gradients painted through, no blur) with a small caps
// title and, beside it, whatever sums the panel up. "How much you've discovered" and "Mix-ups"
// on the home, the coverage panel on an Atlas shelf. Tracked as SAK-336.

import type { ReactNode } from "react";

export interface SkyPanelProps {
  title: string;
  /** The line beside the title: "470 of 15,347 Discovered". */
  aside?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function SkyPanel({ title, aside, className = "", children }: SkyPanelProps) {
  return (
    <section className={`sky-frost rounded-2xl border border-sky-line p-5 font-sky-ui text-sky-ink ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-muted">{title}</h2>
        {aside && <span className="text-[13px] tabular-nums text-sky-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
