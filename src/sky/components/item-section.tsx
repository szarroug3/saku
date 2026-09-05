"use client";

// The titled group an ItemCard sits inside: one per kind of thing. Built
// once so a new section is data rather than markup. Tracked as SAK-293 and
// SAK-301.
//
// A section says what this kind of thing IS and when to start it, and
// offers a way in (Sam's rules, 2026-09-04): "Kana are the sounds of
// Japanese... Learn these first" with a Start button; once started, only
// the title and the things to take. Nothing locked and nothing finished is
// ever listed, and the section carries no counts: what is shown is what can
// be taken, and the cart says what it costs.
//
// The card has no type label (the section is per type) and no status (the
// Atlas carries that in its furniture), so what a thing IS is said here.

import type { ReactNode } from "react";
import { SkyButton } from "@/sky/components/sky-button";

export interface ItemSectionProps {
  title: string;
  /** What this kind of thing is, in one or two sentences. */
  intro?: string;
  /** When to start it: "Learn these first. They are what lets you read." */
  when?: string;
  /** The way in: a button after the intro, "Start kana". */
  start?: { label: string; onClick: () => void; disabled?: boolean };
  children?: ReactNode;
}

export function ItemSection({ title, intro, when, start, children }: ItemSectionProps) {
  return (
    <section className="mt-7 font-sky-ui first:mt-0">
      <div className="border-b border-sky-line pb-1.5">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-sky-accent">{title}</h3>
      </div>

      {(intro || when || start) && (
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="max-w-[70ch]">
            {intro && <p className="text-[13.5px] leading-relaxed text-sky-ink">{intro}</p>}
            {when && <p className={`text-[12.5px] leading-relaxed text-sky-muted ${intro ? "mt-1" : ""}`}>{when}</p>}
          </div>
          {start && <SkyButton onClick={start.onClick} disabled={start.disabled} className="shrink-0">{start.label}</SkyButton>}
        </div>
      )}

      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
