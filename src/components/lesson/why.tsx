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

export function WhyDisclosure({ why }: { why: Why }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mt-4 border-t border-border pt-3.5">
      <p className="text-[13px] leading-relaxed">
        <span className="font-medium">{why.lede.strong}</span>{" "}
        <span className="text-text-muted">{why.lede.rest}</span>{" "}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer whitespace-nowrap rounded border-none bg-transparent p-0 text-[13px] text-accent underline decoration-dotted underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {open ? "Less" : "Why?"}
        </button>
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
