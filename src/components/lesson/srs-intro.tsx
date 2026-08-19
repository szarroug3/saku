"use client";

// The first-run SRS explainer — said ONCE, at the top of Home, dismissible.
// SAK-27. Replaces the old ClaimExplainer (formerly this file, then named
// claim-explainer.tsx / backed by claim-hint.ts), which only explained what
// the "I already know" buttons do. The owner's review asked for something
// bigger: introduce spaced repetition itself, by name, before a new learner
// ever meets a rest screen or a hint button. See src/lib/srs-intro-copy.ts for
// the copy and the sourcing of every claim in it.
//
// PRESENTATION, ROUND TWO (second review pass, same ticket): "i meant for
// this to be a page that appears on your first time on the learn page...
// this is hard to read, a big blob of text. let's unmute the headers and
// main text. accent the things that need to stand out." Fixed by giving it
// real page weight in place (PageTitle, an accent Lbl eyebrow per paragraph,
// a handful of text-accent landmark terms via accentTerms()) rather than
// turning it into a blocking modal.
//
// WHY IN-FLOW, NOT A BLOCKING OVERLAY: her wording is "a page that appears
// on your first time on the learn page", not "a dialog that blocks the
// feed" — and it already IS the first thing rendered on /learn (see
// home-feed.tsx), ahead of every track card, so "appears on your first
// time" is already true positionally. The gap she flagged was that it read
// like just another banner in the scroll, not that it failed to interrupt
// you. The app's only modal precedent (ConfirmProvider / AlertDialog in
// ui/confirm-dialog.tsx) is built for a single yes/no decision with a focus
// trap, not for reading three paragraphs of teaching copy plus a link out;
// stretching it to page-length content would be new, heavier machinery this
// ticket never asked for. A strongly page-shaped in-flow section reads as
// "a page" without inventing that machinery, and it costs a dismissed
// learner nothing extra to scroll past on return visits (moot anyway, since
// isIntroShown means a returning learner never sees it render at all).
//
// WHY THIS REUSES intro-shown.ts AND NOT A NEW claim-hint-STYLE MODULE
// ======================================================================
// The old ClaimExplainer had its own bespoke localStorage key (claim-hint.ts)
// and its own settings-sync field (claimHintDismissed). That machinery is left
// in place (still swept by the knowledge-base reset, still has its own test)
// but nothing renders through it any more — it is not this card's story to
// clean up, and ripping out a settings field touches settings-local.ts,
// types/index.ts and the reset UI for no functional gain here.
//
// This card instead rides the GENERIC once-ever-intro registry already built
// for the curriculum's concept cards (src/lib/intro-shown.ts): its id,
// "intro-srs", is one line in CONCEPT_CARD_IDS, and that alone wires it into
// the existing localStorage key, the existing `introShown` server field
// (settings-local.ts), and the existing knowledge-base reset sweep. No new
// server field, no new settings-local plumbing — the mechanism the app already
// uses everywhere else for "explain this once" is what "explain this once"
// should use here too.
//
// WHY useState + useEffect AND NOT read-during-render
// ===================================================
// Same reasoning the old file carried: localStorage can't be read during SSR
// or the first client paint without a hydration mismatch, so it starts hidden
// and appears after mount if the flag is unset. `null` is "haven't checked
// yet", kept distinct from `false` so a returning learner who dismissed it
// never sees it flash in.

import Link from "next/link";
import { useEffect, useState } from "react";

import { accentTerms, Btn, Lbl, PageTitle } from "@/components/ui";
import { browserStore, isIntroShown, markIntroShown } from "@/lib/intro-shown";
import {
  SRS_INTRO_ACCENTS,
  SRS_INTRO_HEADINGS,
  SRS_INTRO_LINK_HREF,
  SRS_INTRO_LINK_LABEL,
  SRS_INTRO_LINK_TEXT,
  SRS_INTRO_PARAGRAPHS,
} from "@/lib/srs-intro-copy";

/** The registry id this card reads and writes — see intro-shown.ts. */
const SRS_INTRO_ID = "intro-srs";

export function SrsIntro() {
  const [shown, setShown] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(isIntroShown(browserStore(), SRS_INTRO_ID));
  }, []);

  if (shown !== false) return null;

  const onDismiss = () => {
    markIntroShown(browserStore(), SRS_INTRO_ID);
    setShown(true);
  };

  return (
    <div className="kq-material mb-5 flex flex-col gap-4 rounded-xl border border-accent bg-accent-bg p-5">
      <PageTitle
        title="Before you start"
        sub="A quick read on how Saku teaches, then you're set."
      />

      {SRS_INTRO_PARAGRAPHS.map((p, i) => (
        <div key={i}>
          <Lbl tone="accent">{SRS_INTRO_HEADINGS[i]}</Lbl>
          <p className="text-[13px] leading-relaxed text-text">
            {accentTerms(p, SRS_INTRO_ACCENTS[i] ?? [])}
          </p>
        </div>
      ))}

      <p className="text-[13px] leading-relaxed text-text-muted">
        <Link href={SRS_INTRO_LINK_HREF} className="font-medium text-accent">
          {SRS_INTRO_LINK_LABEL}
        </Link>{" "}
        {SRS_INTRO_LINK_TEXT}
      </p>

      <Btn
        go
        type="button"
        onClick={onDismiss}
        aria-label="Got it, don't show this again"
        className="w-fit shrink-0"
      >
        Got it
      </Btn>
    </div>
  );
}
