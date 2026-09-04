// "Mix-ups": pairs that keep getting tangled, one line each. Tracked as
// SAK-336. Just the two names, "日 day and 目 eye", each glyph in its
// standing's colour, and how many runs it happened in. Sam's call
// (2026-09-04): no tiles, the names are enough. Every pair is listed; the
// caller gives the panel a height and it scrolls.

import { japaneseFont } from "@/sky/lib/japanese";
import type { PrerequisiteGraph } from "@/sky/lib/graph";
import { STANDING } from "@/sky/lib/standing";

export interface MixUp {
  a: string;
  b: string;
  /** How many runs it happened in, for the wording. */
  times: number;
}

export interface MixUpsPanelProps {
  graph: PrerequisiteGraph;
  pairs: readonly MixUp[];
  className?: string;
}

function Name({ graph, id }: { graph: PrerequisiteGraph; id: string }) {
  const item = graph.itemOf(id);
  if (!item) return <span className="text-sky-muted">{id}</span>;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-sky-display text-[17px] leading-none ${STANDING[item.standing].text} ${japaneseFont(item.glyph)}`}>{item.glyph}</span>
      <span>{item.english}</span>
    </span>
  );
}

export function MixUpsPanel({ graph, pairs, className = "" }: MixUpsPanelProps) {
  return (
    <section className={`rounded-2xl border border-sky-line bg-sky-card p-5 font-sky-ui text-sky-ink ${className}`}>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-muted">Mix-ups</h2>
      {pairs.length === 0 ? (
        <p className="mt-2 text-[14px] text-sky-muted">You currently have no mix-ups.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5 text-[14px]">
          {pairs.map((p) => (
            <li key={`${p.a}|${p.b}`} className="flex items-baseline gap-2">
              <Name graph={graph} id={p.a} />
              <span className="text-sky-muted">and</span>
              <Name graph={graph} id={p.b} />
              <span className="ml-auto pl-4 text-[13px] tabular-nums text-sky-muted">{p.times} {p.times === 1 ? "time" : "times"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
