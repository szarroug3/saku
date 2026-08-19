"use client";

// The first-run SRS explainer — said ONCE, at the top of Home, dismissible.
// SAK-27. Replaces the old ClaimExplainer (formerly this file, then named
// claim-explainer.tsx / backed by claim-hint.ts), which only explained what
// the "I already know" buttons do. The owner's review asked for something
// bigger: introduce spaced repetition itself, by name, before a new learner
// ever meets a rest screen or a hint button. See src/lib/srs-intro-copy.ts for
// the copy and the sourcing of every claim in it.
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

import { browserStore, isIntroShown, markIntroShown } from "@/lib/intro-shown";
import {
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
    <div className="kq-material mb-3.5 flex flex-col gap-2.5 rounded-xl border border-accent bg-accent-bg p-[18px]">
      {SRS_INTRO_PARAGRAPHS.map((p, i) => (
        <p key={i} className="text-[13px] leading-relaxed text-text">
          {p}
        </p>
      ))}
      <p className="text-[13px] leading-relaxed text-text">
        <Link href={SRS_INTRO_LINK_HREF} className="font-medium text-accent">
          {SRS_INTRO_LINK_LABEL}
        </Link>{" "}
        {SRS_INTRO_LINK_TEXT}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Got it, don't show this again"
        className="kq-material -mb-0.5 w-fit shrink-0 cursor-pointer rounded-lg border border-accent bg-card px-2 py-0.5 text-xs text-accent hover:bg-panel"
      >
        Got it
      </button>
    </div>
  );
}
