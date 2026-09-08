"use client";

// The "why?" affordance — pull, not push.
//
// A beginner staring at a Start button does not want a wall of text between
// them and starting. So the reason a script comes when it does arrives in two
// pieces: one honest line that is always on screen, and the fuller answer folded
// behind a "why?" that stays CLOSED until asked. Open it and it explains
// Japanese; leave it shut and the lede already told the truth, just shorter.
//
// This holds no state anywhere but its own useState, blocks nothing below it,
// and never fires a dialog. It renders content from src/data/why.ts — the words
// are the data file's problem, the disclosure is this file's.

import { useId, useState } from "react";

import type { Why } from "@/data/why";
import { RoundButton } from "@/sky/components/sky-button";

export function WhyDisclosure({ why }: { why: Why }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    // A quiet caption — muted and small, no rule — so it reads as a footnote to
    // its section, not a boundary. The reasoning opens behind "Why?".
    <div className="mt-3">
      <p className="text-[11px] leading-relaxed text-text-muted">
        {why.lede.strong}{" "}
        {/* Optional: some ledes say everything they honestly can in the strong
            fragment, and the rest of the reasoning lives behind the button. */}
        {why.lede.rest ? <>{why.lede.rest} </> : null}
        {/* The Sky's one expander (SAK-412). The word stays beside the button
            because a bare chevron in a footnote names nothing: "Why?" is the
            question the fold answers. */}
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
          <span className="text-[11px] text-accent">Why?</span>
          <RoundButton
            label={open ? "Hide the reason why" : "Show the reason why"}
            expanded={open}
            controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "⌃" : "⌄"}
          </RoundButton>
        </span>
      </p>

      {/* Rendered only when asked. The paragraphs are the teaching; nothing here
          narrates the app, so they earn their full length once opened. */}
      {open ? (
        <div id={panelId} className="mt-2.5 flex flex-col gap-2.5">
          {why.paras.map((p, i) => (
            <p
              key={i}
              className="text-[13px] leading-relaxed text-text-muted"
            >
              {p}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
