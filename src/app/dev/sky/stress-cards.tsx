"use client";

// A performance rig for the wash. Route: any dev sky page that mounts it.
//
// Turned on, it covers the page with a fixed wash (the layer the app will
// paint under everything) and scrolls a long column of "How much you've
// covered" cards over it, enough to make the page scroll, so resize and scroll
// can be judged with the kind of content the sky will actually carry. The
// cards are the home's own SkyPanel, so whatever it is made of (a frosted
// ground, a blur) is what gets judged. The wash switch stays reachable, so
// the same column can be tried over each mode.

import { useState } from "react";

import { SkyPanel } from "@/sky/components/sky-panel";

const COUNTS = [0, 40, 120] as const;

const STANDINGS = [
  { name: "solid", dot: "bg-sky-mint" },
  { name: "getting there", dot: "bg-sky-pale" },
  { name: "shaky", dot: "bg-sky-amber" },
  { name: "slipping", dot: "bg-sky-coral" },
  { name: "claimed", dot: "bg-sky-lilac" },
] as const;

/** A seeded spread so every card shows different, stable numbers. */
function spread(i: number): number[] {
  const total = 24 + ((i * 7) % 40);
  const solid = Math.round(total * (0.55 + ((i * 13) % 35) / 100));
  const rest = total - solid;
  const a = Math.round(rest * (((i * 3) % 5) / 10));
  const b = Math.round((rest - a) * (((i * 5) % 4) / 6));
  const c = Math.round((rest - a - b) * (((i * 11) % 3) / 4));
  const d = rest - a - b - c;
  return [solid, a, b, c, d];
}

function CoverageCard({ index }: { index: number }) {
  const counts = spread(index);
  const total = counts.reduce((s, n) => s + n, 0);
  const constellations = Math.max(3, Math.round(total / 3.2));
  return (
    <SkyPanel title="How much you've covered" aside={`${total} stars · ${constellations} constellations`}>
      <div className="mt-4 flex h-3.5 overflow-hidden rounded-full bg-sky-card-strong">
        {STANDINGS.map((s, k) => counts[k] > 0 && <div key={s.name} className={`h-full ${s.dot}`} style={{ width: `${(counts[k] / total) * 100}%` }} />)}
      </div>
      <ul className="mt-5 space-y-3 text-[19px]">
        {STANDINGS.map((s, k) => (
          <li key={s.name} className="flex items-center gap-4">
            <span className={`h-3.5 w-3.5 rounded-full ${s.dot}`} />
            <span className="flex-1">{s.name}</span>
            <span className="font-semibold tabular-nums">{counts[k]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[17px] leading-relaxed text-sky-muted">
        Every star in the sky wears its own colour: the standing Saku currently gives it. Solid stays quiet; shaky and slipping are what tonight&apos;s drill will reach for first.
      </p>
    </SkyPanel>
  );
}

export function StressCards() {
  const [count, setCount] = useState<(typeof COUNTS)[number]>(0);
  return (
    <>
      <div className="fixed bottom-4 left-4 z-[60] flex items-center gap-1 rounded-full border border-sky-line bg-sky-card-strong p-1 font-sky-ui text-[12px] text-sky-muted">
        <span className="px-2">cards</span>
        {COUNTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCount(n)}
            aria-pressed={count === n}
            className={`rounded-full px-2.5 py-1 ${count === n ? "bg-sky-ink text-sky-ground-0" : "hover:text-sky-ink"}`}
          >
            {n === 0 ? "none" : n}
          </button>
        ))}
      </div>

      {count > 0 && (
        <>
          {/* the wash the app will paint under everything: fixed, one compositor layer */}
          <div className="sky-wash pointer-events-none fixed inset-0 z-50" aria-hidden />
          <div className="fixed inset-0 z-[51] overflow-y-auto font-sky-ui" data-testid="stress-scroll">
            <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-6 pb-24 pt-8">
              <p className="text-[13px] text-sky-muted">
                {count} cards over the wash. Scroll and resize; switch the wash mode bottom right to compare, and set cards to none to leave.
              </p>
              {Array.from({ length: count }, (_, i) => <CoverageCard key={i} index={i} />)}
            </div>
          </div>
        </>
      )}
    </>
  );
}
