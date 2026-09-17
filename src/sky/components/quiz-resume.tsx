// What you left, offered back (SAK-404, SAK-444). Two shapes, both quiet.
//
// The BUTTON is what the Planetarium and the Observatory show, because those
// are where a learner lands. One button, beside the heading, saying what it
// goes back to and how far in: "Continue your lesson (step 3 of 7)", or
// "Continue your quiz (12 of 30)". It is there only when there is something
// to continue: a page that says "Continue where you left off?" when there is
// nothing to continue is worse than a page that says nothing.
//
// ONE BUTTON, THE NEWEST WINS. A learner can have both a quiz and a lesson
// part way through, and two Continue buttons side by side is a question
// rather than an offer. So the heading carries the newest of them and the
// other waits in Sessions, which is the page that lists what you have been
// doing.
//
// The ASK is what the quiz shows when you arrive on a different run while one
// is unfinished. Only one quiz is kept, so starting another replaces it, and
// that is the kind of thing the Sky asks about once (SAK-364, InlineAsk).

import { InlineAsk } from "@/sky/components/inline-ask";
import { SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { placeLabel, type PlaceEntry } from "@/sky/lib/place";
import { runNote, type SavedRun } from "@/sky/lib/quiz-run";

/** The one button, on a page that is neither the quiz nor the lesson. The
 * href is the route's, since only it knows what a Sky URL looks like
 * (SAK-367). */
export function ContinueButton({ entry, href, className = "" }: { entry: PlaceEntry; href: string; className?: string }) {
  return <SkyButton variant="outline" href={href} className={className}>{placeLabel(entry)}</SkyButton>;
}

/** The ask, in place of a quiz that would replace the quiz you have. */
export function ResumeAsk({ run, href, title = "Tonight's drill", onStart, onKeep, height }: {
  run: SavedRun;
  /** Where the quiz you already have is answered, for the "Go back to it" side. */
  href: string;
  title?: string;
  onStart: () => void;
  onKeep: (href: string) => void;
  height?: string;
}) {
  return (
    <SkyPageShell eyebrow="Quiz" title={title} height={height}>
      <SkySurface className="mx-auto max-w-[560px]">
        <InlineAsk
          what={`You have an unfinished quiz (${runNote(run)}). Starting this one replaces it.`}
          confirm="Start and replace"
          keepLabel="Go back to it"
          onConfirm={onStart}
          onKeep={() => onKeep(href)}
        />
      </SkySurface>
    </SkyPageShell>
  );
}
