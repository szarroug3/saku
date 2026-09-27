// What you left, offered back (SAK-404, SAK-444). Two shapes, both quiet.
//
// The BUTTON is what the Planetarium and the Observatory show, because those
// are where a learner lands. One button, beside the heading, saying what it
// goes back to and how far in: "Continue your lesson (step 3 of 7)",
// "Continue your lesson (round 1, card 4 of 18)", "Continue your lesson
// (break before round 2 of 3, 3 min left)", or "Continue your quiz (12 of
// 30)". It is there only when there is something to continue: a page that
// says "Continue where you left off?" when there is nothing to continue is
// worse than a page that says nothing.
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
//
// AND AN X (SAK-492). Sam, 2026-09-26: "let's make it so i can click x on
// this or something to cancel the current lesson in progress and then they
// would come back." The X is the round button every panel closes with, inside
// the button's own box at its right end. The link keeps the whole box, padded
// the same on both sides so its words stay in the middle, and the X sits over
// the right-hand padding. Pressing it asks before anything is forgotten
// ("Forget it forever" or "Keep it"), in the button's place and at its width.
//
// THE SAME BUTTON EVERYWHERE (Sam, 2026-09-27: "all continue lesson buttons
// should use the same component so they look the same. Right now, only one
// of them shows the x button"). The Planetarium, the Observatory and a
// Sessions row all draw this one, X included, and the route hands each the
// same forget.

import { useState } from "react";

import { InlineAsk } from "@/sky/components/inline-ask";
import { RoundButton, SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import { useNow } from "@/sky/components/use-now";
import { placeLabel, type PlaceEntry } from "@/sky/lib/place";
import { runNote, type SavedRun } from "@/sky/lib/quiz-run";

/** What a page is handed to draw the button: the thing left part way
 * through, the route's way back to it (only the route knows what a Sky URL
 * looks like, SAK-367), and the forget behind the X. */
export interface Resume {
  entry: PlaceEntry;
  href: string;
  /** Forgets it for good, behind the X and its ask (SAK-492). Absent draws
   * the plain button, with no X: a learner who cannot forget it (the pretend
   * learner keeps no place, so it never comes up). */
  onForget?: () => Promise<void>;
}

/** The one button, on a page that is neither the quiz nor the lesson.
 *
 * The clock is the reader's, not the server's. A signed-in learner's button is
 * rendered on the server from the account's place, and a break counted there
 * would be counted against the server's minute; so the break says which break
 * it is until this is a browser, and gains the minutes left after (SAK-355,
 * the same trade the sessions list makes for its timestamps). */
export function ContinueButton({ entry, href, onForget, className = "" }: Resume & { className?: string }) {
  // every half minute, which is as fine as "3 min left" ever needs
  const now = useNow(30_000);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = placeLabel(entry, now);
  if (!onForget) return <SkyButton variant="outline" href={href} className={className}>{label}</SkyButton>;
  if (asking) {
    const confirm = async () => {
      setBusy(true);
      try { await onForget(); } finally { setBusy(false); setAsking(false); }
    };
    return <InlineAsk className={`justify-end ${className}`} confirm="Forget it forever" busyLabel="Forgetting…" busy={busy} onConfirm={confirm} onKeep={() => setAsking(false)} />;
  }
  // !px-10: 40px on each side, which is the X's 28px, the 5px it sits in from
  // the edge, and a gap before the words; the same on the left so the words
  // are centered in the whole box, not in what the X leaves of it
  return (
    <span className={`relative inline-flex ${className}`}>
      <SkyButton variant="outline" href={href} className="w-full !px-10">{label}</SkyButton>
      <RoundButton label={`Forget this ${entry.kind}`} onClick={() => setAsking(true)} className="absolute right-[5px] top-1/2 -translate-y-1/2">×</RoundButton>
    </span>
  );
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
