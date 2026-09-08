// "Mix-ups": pairs that keep getting tangled, one line each. Tracked as
// SAK-336. Just the two names, "日 day and 目 eye", each glyph in its
// standing's colour, and how many runs it happened in. Sam's call
// (2026-09-04): no tiles, the names are enough. Every pair is listed; the
// caller gives the panel a height and it scrolls. Practice shows the same
// panel for its pool.

import { Glyph } from "@/sky/components/glyph";
import { SkyTextButton } from "@/sky/components/sky-button";
import { SkyPanel } from "@/sky/components/sky-panel";
import type { SkyItem } from "@/sky/lib/types";

export interface MixUp {
  /** The pair's key, for clearing it. */
  key: string;
  a: string;
  b: string;
  /** How many runs it happened in, for the wording. */
  times: number;
  /** Clean runs in a row so far, and how many clear it (Settings). */
  cleanRuns: number;
  needed: number;
}

export interface MixUpsPanelProps {
  pairs: readonly MixUp[];
  /** Names the ids: a graph's `itemOf`, or a lookup into any item list. */
  itemOf: (id: string) => SkyItem | undefined;
  /** Clears a pair by hand: it stops being watched until it happens again. */
  onClear?: (key: string) => Promise<void> | void;
  title?: string;
  className?: string;
}

function Name({ item, id }: { item: SkyItem | undefined; id: string }) {
  if (!item) return <span className="text-sky-muted">{id}</span>;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <Glyph glyph={item.glyph} standing={item.standing} />
      <span>{item.english}</span>
    </span>
  );
}

export function MixUpsPanel({ pairs, itemOf, onClear, title = "Mix-ups", className = "" }: MixUpsPanelProps) {
  return (
    <SkyPanel title={title} className={className}>
      {pairs.length === 0 ? (
        <p className="mt-2 text-[14px] text-sky-muted">No mix-ups. When you keep swapping two things for each other, they show up here.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5 text-[14px]">
          {pairs.map((p) => (
            <li key={p.key} className="flex flex-wrap items-baseline gap-2">
              <Name item={itemOf(p.a)} id={p.a} />
              <span className="text-sky-muted">and</span>
              <Name item={itemOf(p.b)} id={p.b} />
              <span className="ml-auto flex items-baseline gap-3 pl-4 text-[13px] tabular-nums text-sky-muted">
                <span>{p.times} {p.times === 1 ? "time" : "times"}</span>
                <span title="Clean runs in a row; the mix-up clears itself at the number set in Settings">{p.cleanRuns} of {p.needed} clean</span>
                {onClear && <SkyTextButton onClick={() => onClear(p.key)}>Clear</SkyTextButton>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SkyPanel>
  );
}
