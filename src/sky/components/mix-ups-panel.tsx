// "Mix-ups": pairs of stars that keep getting tangled, as tiles. Tracked as
// SAK-336. The home shows the worst one or two; Practice can show them all.

import { ConstellationTile } from "@/sky/components/constellation-tile";
import type { PrerequisiteGraph } from "@/sky/lib/graph";

export interface MixUp {
  a: string;
  b: string;
  /** How many runs it happened in, for the wording. */
  times: number;
}

export interface MixUpsPanelProps {
  graph: PrerequisiteGraph;
  pairs: readonly MixUp[];
  /** How many pairs to show. */
  limit?: number;
  className?: string;
}

export function MixUpsPanel({ graph, pairs, limit = 2, className = "" }: MixUpsPanelProps) {
  const shown = pairs.slice(0, limit);
  return (
    <section className={`rounded-2xl border border-sky-line bg-sky-card p-5 font-sky-ui text-sky-ink ${className}`}>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-muted">Mix-ups</h2>
      {shown.length === 0 ? (
        <p className="mt-2 max-w-[40ch] text-[14px] leading-relaxed text-sky-muted">Nothing tangled right now. When you answer one star when it asked for another, the pair shows up here.</p>
      ) : (
        <>
          <p className="mt-2 max-w-[40ch] text-[14px] leading-relaxed text-sky-muted">
            {shown.length === 1 ? "Two stars that keep getting tangled" : "Stars that keep getting tangled"}: you answered one when it asked for the other.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {shown.map((p) => (
              <li key={`${p.a}|${p.b}`} className="flex items-center gap-4">
                <ConstellationTile graph={graph} id={p.a} size={56} />
                <span className="text-sky-muted" aria-hidden>and</span>
                <ConstellationTile graph={graph} id={p.b} size={56} />
                <span className="ml-auto text-[13px] tabular-nums text-sky-muted">{p.times} {p.times === 1 ? "time" : "times"}</span>
              </li>
            ))}
          </ul>
          {pairs.length > shown.length && <p className="mt-2 text-[12.5px] text-sky-muted">and {pairs.length - shown.length} more</p>}
        </>
      )}
    </section>
  );
}
