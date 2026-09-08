// A run you left, offered back (SAK-404). Two shapes, both quiet.
//
// The LINE is what the Planetarium and the Observatory show, because those
// are where a learner lands. It is one sentence and a link, under the
// heading, and it is there only when there is a run: a page that says
// "Continue where you left off?" when there is nothing to continue is worse
// than a page that says nothing.
//
// The ASK is what the quiz shows when you arrive on a different run while one
// is unfinished. Only one run is kept, so starting another lets the first go,
// and that is the kind of thing the Sky asks about once (SAK-364, InlineAsk).
// "Keep it" means keep the run you had, so it goes back to it.

import { InlineAsk } from "@/sky/components/inline-ask";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { runNote, type SavedRun } from "@/sky/lib/quiz-run";

/** The one line, on a page that is not the quiz. */
export function ResumeLine({ run, href, className = "" }: { run: SavedRun; href: string; className?: string }) {
  return (
    <p className={`font-sky-ui text-[13px] text-sky-muted ${className}`.trim()}>
      Continue where you left off?{" "}
      <a href={href} className="text-sky-accent underline">{runNote(run)}</a>
    </p>
  );
}

/** The ask, in place of a quiz that would replace the run you have. */
export function ResumeAsk({ run, href, title = "Tonight's drill", onStart, onKeep, height }: {
  run: SavedRun;
  /** Where the run you already have is answered, for the "Keep it" side. */
  href: string;
  title?: string;
  onStart: () => void;
  onKeep: (href: string) => void;
  height?: string;
}) {
  return (
    <SkyPageShell eyebrow="Quiz" title={title} height={height}>
      <SkySurface className="mx-auto max-w-[560px]">
        <p className="text-[14px] text-sky-muted">You left a quiz part way through: {runNote(run)}.</p>
        <InlineAsk
          className="mt-3"
          what="Only one run is kept, so starting this one lets that one go."
          confirm="Start this one"
          onConfirm={onStart}
          onKeep={() => onKeep(href)}
        />
      </SkySurface>
    </SkyPageShell>
  );
}
