"use client";

// Gallery for FilterChipRow, ToggleChip and CoverageBar. Route: /dev/sky/filters
//
// Interactive on purpose: the chips are stateful and their counts are
// recomputed from a small pool as you pick, so the "none" rule and the
// disabled state can be seen doing their job.

import { useMemo, useState } from "react";

import { CoverageBar } from "@/sky/components/coverage-bar";
import { FilterChipRow, ToggleChip } from "@/sky/components/filter-chip-row";
import { StandingLegend } from "@/sky/components/standing-legend";
import { knownCount } from "@/sky/lib/coverage";
import type { Standing } from "@/sky/lib/standing";

/** A small pool to filter: kind, collection, whether it was ever missed. */
const POOL: Array<{ id: string; kind: "kanji" | "word" | "kana"; collection: string; standing: Standing; missed: boolean; component?: string }> = [
  { id: "日", kind: "kanji", collection: "Grade 1", standing: "solid", missed: false, component: "日" },
  { id: "本", kind: "kanji", collection: "Grade 1", standing: "solid", missed: true, component: "木" },
  { id: "時", kind: "kanji", collection: "Grade 2", standing: "shaky", missed: true, component: "日" },
  { id: "間", kind: "kanji", collection: "Grade 2", standing: "slipping", missed: true, component: "門" },
  { id: "日本", kind: "word", collection: "Places", standing: "solid", missed: false },
  { id: "時間", kind: "word", collection: "Time", standing: "getting-there", missed: true },
  { id: "あ", kind: "kana", collection: "Vowels", standing: "claimed", missed: false },
  { id: "か", kind: "kana", collection: "K row", standing: "not-seen", missed: false },
];
const KINDS = ["kanji", "word", "kana"] as const;
const COMPONENTS = ["日", "木", "門", "氵"];

export default function SkyFiltersPage() {
  const [kinds, setKinds] = useState<string[]>([]);
  const [component, setComponent] = useState<string | null>(null);
  const [missedOnly, setMissedOnly] = useState(false);

  const matches = useMemo(() => POOL.filter((p) => (kinds.length === 0 || kinds.includes(p.kind)) && (component === null || p.component === component) && (!missedOnly || p.missed)), [kinds, component, missedOnly]);
  // each chip's count is what picking it would give, with the other filters as they are
  const kindCount = (k: string) => POOL.filter((p) => p.kind === k && (component === null || p.component === component) && (!missedOnly || p.missed)).length;
  const componentCount = (c: string) => POOL.filter((p) => p.component === c && (kinds.length === 0 || kinds.includes(p.kind)) && (!missedOnly || p.missed)).length;
  const missedCount = POOL.filter((p) => p.missed && (kinds.length === 0 || kinds.includes(p.kind)) && (component === null || p.component === component)).length;
  const componentsApply = kinds.length === 0 || kinds.includes("kanji");

  const skyCounts: Partial<Record<Standing, number>> = { solid: 27, "getting-there": 1, shaky: 1, slipping: 1, claimed: 2 };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-text">Filter chips and the coverage bar</h2>
        <p className="mt-1 max-w-[72ch] text-sm text-text-muted">
          Two primitives the Atlas, the home and Practice share. Chips carry the count
          picking them would give; a chip that would return nothing says so and cannot be
          picked. The bar is drawn against the whole collection, never the filtered part.
        </p>
      </section>

      <section className="sky-wash flex flex-col gap-5 rounded-2xl border border-sky-line p-6 font-sky-ui text-sky-ink">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Kind, pick any</div>
          <FilterChipRow className="mt-2" mode="multi" label="Kind" selected={kinds} onChange={setKinds} options={KINDS.map((k) => ({ value: k, label: k, count: kindCount(k) }))} />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Made of, pick one or any</div>
          <FilterChipRow
            className="mt-2"
            mode="single"
            label="Component"
            selected={component}
            onChange={setComponent}
            options={COMPONENTS.map((c) => ({ value: c, label: c, count: componentCount(c), disabled: componentsApply ? false : "Only kanji are made of parts" }))}
          />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Toggle</div>
          <ToggleChip className="mt-2" label="only ones I have missed" pressed={missedOnly} onChange={setMissedOnly} count={missedCount} />
        </div>
        <div className="rounded-2xl border border-sky-line bg-sky-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">{matches.length} of {POOL.length}</div>
          <div className="mt-2 flex flex-wrap gap-2 font-sky-display text-xl">
            {matches.map((m) => <span key={m.id}>{m.id}</span>)}
            {matches.length === 0 && <span className="font-sky-ui text-sm text-sky-muted">Nothing matches, and the chips said so before you got here.</span>}
          </div>
        </div>
      </section>

      <section className="sky-wash flex flex-col gap-6 rounded-2xl border border-sky-line p-6 font-sky-ui text-sky-ink">
        <div className="max-w-[46ch] rounded-2xl border border-sky-line bg-sky-card p-4">
          <div className="flex items-baseline justify-between gap-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">How much you&apos;ve covered</div>
            <div className="text-[12.5px] text-sky-muted">32 stars · 10 constellations</div>
          </div>
          <CoverageBar className="mt-3 h-3" counts={skyCounts} total={32} label="the sky" />
          <StandingLegend className="mt-3" standings={["solid", "getting-there", "shaky", "slipping", "claimed"]} counts={skyCounts} />
        </div>

        <div className="max-w-[46ch]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">An Atlas shelf: {knownCount({ solid: 28, claimed: 3 })} of 2,136 kanji known</div>
          <CoverageBar className="mt-2 h-2.5" counts={{ solid: 28, "getting-there": 4, shaky: 3, slipping: 2, claimed: 3 }} total={2136} label="kanji" />
          <p className="mt-1 text-[12px] text-sky-muted">Drawn against all 2,136, so 40 seen is a sliver. Every segment with a count still shows, at least as a hairline.</p>
        </div>

        <div className="max-w-[46ch]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Nothing yet: 0 of 46 kana</div>
          <CoverageBar className="mt-2 h-2.5" counts={{}} total={46} label="kana" />
          <p className="mt-1 text-[12px] text-sky-muted">An empty bar is still a bar.</p>
        </div>

        <div className="max-w-[46ch]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Everything: 12 of 12 counters</div>
          <CoverageBar className="mt-2 h-2.5" counts={{ solid: 9, claimed: 3 }} total={12} label="counters" />
        </div>
      </section>
    </div>
  );
}
