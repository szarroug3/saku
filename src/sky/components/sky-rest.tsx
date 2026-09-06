"use client";

// The rest between a lesson's rounds: a clock and nothing else (SAK-343).
// The app's rule for this screen, kept: nothing here that could be
// rehearsed with. No list of the round's cards, no misses, no preview of
// what comes next. How long, a way to skip the wait, and the way out.

import { useEffect, useState } from "react";

import { SkyButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { SkyStepper } from "@/sky/components/sky-stepper";
import { formatCountdown, formatReturnTime, restLeft } from "@/sky/lib/rest";

export interface SkyRestProps {
  /** When the rest ends. */
  until: number;
  nextRound: number;
  rounds: number;
  onStart: () => void;
  /** How long this rest is, in minutes, and the way to change it here:
   * the setting lives on this screen (Sam, 2026-09-06), not in Settings. */
  minutes: number;
  onMinutes: (minutes: number) => void;
  /** The way out: back to the observatory. */
  skyHref: string;
  height?: string;
}

/** The clock, read every second while the rest runs. Null before the first
 * read on the client, so the server never claims a number. */
function useNow(ticking: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!ticking) return;
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, [ticking]);
  return now;
}

export function SkyRest({ until, nextRound, rounds, onStart, minutes, onMinutes, skyHref, height }: SkyRestProps) {
  const now = useNow(true);
  const left = now === null ? Number.POSITIVE_INFINITY : restLeft(until, now);
  const ready = left === 0;
  return (
    <SkyPageShell eyebrow="Quiz" title="A rest" height={height}>
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 font-sky-ui">
        <SkySurface className="px-6 py-10 text-center">
          <Eyebrow>{ready ? `Round ${nextRound} of ${rounds}` : `Until round ${nextRound} of ${rounds}`}</Eyebrow>
          {ready ? (
            <p className="mt-3 font-sky-display text-[26px] text-sky-ink">Ready when you are.</p>
          ) : (
            <>
              <p className="mt-3 font-sky-display text-[72px] leading-none tracking-tight text-sky-ink tabular-nums">{Number.isFinite(left) ? formatCountdown(left) : " "}</p>
              <p className="mt-4 text-[13.5px] text-sky-muted">Come back at {formatReturnTime(until)}</p>
            </>
          )}
          <div className="mt-6 flex justify-center gap-2">
            {ready ? <SkyButton onClick={onStart}>Start round {nextRound}</SkyButton> : <SkyButton variant="outline" onClick={onStart}>Start now</SkyButton>}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-[12.5px] text-sky-muted">
            <span>{nextRound <= 2 ? "The first rest is" : "Every rest after the first is"}</span>
            <SkyStepper value={minutes} onChange={onMinutes} label="Minutes of rest" min={0} max={240} unit="minutes" />
          </div>
        </SkySurface>
        <p className="text-center text-[12.5px] text-sky-muted">The rest is the point: what you just did settles while you are not looking at it. Leaving is free; the clock keeps counting. <a href={skyHref} className="underline hover:text-sky-ink">Back to the observatory</a></p>
      </div>
    </SkyPageShell>
  );
}
