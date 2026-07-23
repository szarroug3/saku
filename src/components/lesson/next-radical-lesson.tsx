"use client";

// Up next, a step ahead of kanji — the card that teaches the building block
// before the kanji that is filed under it.
//
// It is the kanji card's twin: a lesson with no name, a meaning per item, a
// position counted in items ("radicals 3–6 of 98"), and the same two routes
// in (Start walks then drills, "Quiz me" drills now). What it does NOT share is
// the reason it exists — a radical is taught so that when its kanji is broken
// into parts, none of those parts is a shape the learner has never met. The
// "appears in N kanji" line under each glyph is that reason made visible: this
// piece is worth a card because it is about to come back.
//
// WHAT IT MAY SAY
// ===============
// Every word is read off src/data/radicals.ts or counted from it: the radical,
// its meaning, and which RADICAL of the 98 this track teaches (the other 116 are
// their own kanji and are taught on the kanji card). The "in N kanji" count is
// radicalConsumerCount — how many jōyō kanji file under this radical — and it is
// omitted for the orphans (radicals no common kanji uses), which are taught at
// the tail for completeness and have nothing to point forward to.

import Link from "next/link";

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import { radicalEntry } from "@/data/radicals";
import { WHY_TRACK } from "@/data/why";
import type { RadicalLesson } from "@/lib/radical-lesson";
import { positionLabel } from "@/lib/lesson-position";
import { entryHref } from "@/lib/library/href";
import type { FactId } from "@/types";

export function NextRadicalLesson({
  lesson,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: RadicalLesson;
  /**
   * Start the lesson. The facts ARE the session — no budget, no length: the
   * unit was decided by the material. `teach: false` is the skip-the-lesson
   * route (drill now, no walk), the same handler and facts as Start so the two
   * differ only in whether the walk happens. See next-kanji-lesson.tsx.
   */
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know this", over whatever slice the button named. */
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  const { position, cards } = lesson;

  return (
    <Card>
      <Lbl>Up next · {positionLabel("radicals", position)}</Lbl>

      {/* The radicals ARE the links: each tile is the glyph, its meaning, and
          how many kanji it shows up in — the entry page carries the rest. An
          orphan radical (in no common kanji) keeps the row height with a spacer
          rather than printing "in 0 kanji", which would read as a demerit on a
          card whose whole point is that this piece is coming back. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card) => (
          <Link
            key={card.glyph}
            href={entryHref(radicalEntry(card.glyph))}
            className="min-w-[92px] flex-1 rounded-lg border border-border px-2 pb-2.5 pt-3 text-center text-text no-underline hover:bg-panel"
          >
            <span className="block text-[34px] font-extralight leading-[1.15]">
              {card.glyph}
            </span>
            <span className="mt-1 block text-[13px] text-text-muted">
              {card.meaning}
            </span>
            {card.appearsIn > 0 ? (
              <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
                In {card.appearsIn} kanji
              </span>
            ) : (
              <span className="mt-1 block min-h-[12px]" />
            )}
          </Link>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={() => onClaim(lesson.facts)}>
          I already know{" "}
          {cards.length === 1 ? "this" : `these ${cards.length}`}
        </Btn>
        {/* The two routes in, in kanji's arrangement: "Quiz me" drills now,
            Start walks then drills. Both mark these radicals seen; only Start
            shows them to you first. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn onClick={() => onStart(lesson.facts, { teach: false })}>
            Quiz me
          </Btn>
          {inSession && onContinue ? (
            <Btn go onClick={onContinue}>
              Continue session
            </Btn>
          ) : (
            <Btn go onClick={() => onStart(lesson.facts)}>
              Start
            </Btn>
          )}
        </div>
      </div>

      {/* Why radicals, and why now — the building-block idea and the gate that
          teaches them a step ahead of kanji. A pull, so only the lede shows
          until opened. */}
      <WhyDisclosure why={WHY_TRACK.radical} />
    </Card>
  );
}
