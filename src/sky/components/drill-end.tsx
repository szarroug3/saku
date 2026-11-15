// The last screen of a Practice drill, shared by the readings drill and the
// writing drill: the score, a line saying what it counts, and the promise
// that nothing was saved. Each drill says its own lines; the layout is here.

import { SkyButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyPageBody } from "@/sky/components/sky-page-body";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";

/** A fresh seed for a drill's order, one per run. */
export const newDrillSeed = () => Math.floor(Math.random() * 2 ** 31);

export function DrillEndView({ right, of, line, empty, backHref, height, onAgain }: {
  /** Answers right. */
  right: number;
  /** Answers counted. Zero shows `empty` in place of the score. */
  of: number;
  /** What the score counts, in a sentence. */
  line: string;
  /** What to say when the run ended before any answer. */
  empty: string;
  /** Where Back to practice goes. */
  backHref: string;
  height?: string;
  onAgain: () => void;
}) {
  return (
    <SkyPageShell eyebrow="Practice" title="How it went" height={height}>
      <SkyPageBody width="reading">
        <SkySurface className="flex flex-col items-center gap-2 text-center">
          {of > 0 ? (
            <>
              <Eyebrow tight>Your score</Eyebrow>
              <p className="font-sky-display text-[44px] leading-none text-sky-ink tabular-nums">{right} of {of}</p>
              <p className="text-[14px] text-sky-ink/90">{line}</p>
            </>
          ) : (
            <p className="text-[14px] text-sky-ink/90">{empty}</p>
          )}
          <p className="text-[13px] text-sky-muted">Nothing from this drill is saved.</p>
        </SkySurface>
        <div className="flex flex-wrap gap-2">
          <SkyButton onClick={onAgain}>Start over</SkyButton>
          <SkyButton variant="outline" href={backHref}>Back to practice</SkyButton>
        </div>
      </SkyPageBody>
    </SkyPageShell>
  );
}
