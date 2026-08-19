"use client";

// LessonRail — a quiet "up next" preview for the lesson (teach-phase) screen.
// SAK-10, direction 2. The centering fix (direction 1, globals.css's
// .kq-center-frame and the matching justify-center below) turned "a card, then
// a void" into "a card, centered, with a void on both sides" — better on tall
// content, worse on a one-line card, because the emptiness reads as MORE
// deliberate once it's symmetric. This rail fills the side margin the
// centering opened up with real, ambient content instead of more whitespace.
//
// AMBIENT, NOT ANOTHER CONTROL. Nothing here is clickable and nothing is
// graded — it previews the next few steps of THIS lesson's walk, fading out
// toward the end so it reads as "coming up", not as a second list to read.
// Hidden below xl: the sidebar + a readable content column already leave no
// honest side margin on a laptop-width screen, and a cramped rail would be
// worse than the void it's replacing.
//
// GLYPH TILES borrow the small bordered-tile look the drill screens already
// use for a board of characters (quiz/drill-screen.tsx's grid tiles), just
// smaller and muted — same shape, quieter finish, so it reads as "one more of
// those" rather than inventing a new tile style.
//
// NOT EVERY STEP HAS A GLYPH. A concept/track-intro card and a term page (see
// lib/lesson-steps.ts) teach an idea, not a character, so they render a plain
// dot instead of a blank tile — never invented text standing in for a glyph
// that doesn't exist.

import { factInfo } from "@/lib/facts";
import type { LessonStep } from "@/lib/lesson-steps";
import { subjectLabel } from "@/lib/library/entries";
import { termFor } from "@/data/terms";

/** How many upcoming steps the rail shows. Four is enough to read as "a queue"
 * without turning into a second scrollable list. */
const RAIL_SIZE = 4;

/** The tile glyph for one upcoming step, or "" when the step teaches an idea
 * rather than a character (an intro/term card owns no single glyph — see
 * lesson-steps.ts's LessonStep). */
function railGlyph(step: LessonStep): string {
  switch (step.type) {
    case "item":
      return step.item.glyph;
    case "conversion":
      // The mark itself (゛/゜) — the one glyph a conversion-row card is about.
      return step.row.mark;
    default:
      return "";
  }
}

/** The small caption under a tile — what KIND of thing is coming, not what it
 * says (that's the lesson's own reveal, not the rail's to spoil). */
function railCaption(step: LessonStep): string {
  switch (step.type) {
    case "item":
      return subjectLabel(factInfo(step.item.facts[0])) ?? "Item";
    case "conversion":
      return step.row.markName;
    case "term":
      return termFor(step.entry)?.name ?? "Concept";
    case "intro":
      return step.intro.eyebrow ?? "Before you go on";
  }
}

export function LessonRail({
  steps,
  at,
}: {
  /** The full teach walk, in order — the same list session/page.tsx counts
   * for "N of M". */
  steps: readonly LessonStep[];
  /** The step showing now; the rail previews what comes AFTER it. */
  at: number;
}) {
  const upcoming = steps.slice(at + 1, at + 1 + RAIL_SIZE);
  if (upcoming.length === 0) return null;
  return (
    <aside
      // Decorative preview of material the walk itself will announce in full
      // when you get there — a screen reader already has "N of M" from the HUD
      // and doesn't need this queue read aloud too.
      aria-hidden="true"
      className="hidden w-36 shrink-0 flex-col gap-3 xl:flex"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted/60">
        Up next
      </p>
      <ol className="flex flex-col gap-2.5">
        {upcoming.map((step, i) => {
          const glyph = railGlyph(step);
          return (
            <li
              key={step.key}
              className="flex items-center gap-2.5"
              // Fades toward the end of the queue, so the rail reads as a
              // horizon rather than a flat list — the nearest step is the most
              // present, exactly like the card it sits beside.
              style={{ opacity: 1 - i * 0.2 }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 px-0.5 font-kana text-[13px] leading-none text-text-muted"
                lang={glyph ? "ja" : undefined}
              >
                {glyph ? (
                  <span className="block w-full min-w-0 truncate text-center">{glyph}</span>
                ) : (
                  <span className="size-1.5 rounded-full bg-text-muted/50" />
                )}
              </span>
              <span className="truncate text-[11px] leading-tight text-text-muted/70">
                {railCaption(step)}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
