"use client";

// Up next in the keigo track — the card that teaches the next few politeness
// sets whose plain verb the learner has already met.
//
// It is the transitivity card's cousin: a lesson with no name, a position counted
// in items ("keigo sets 1-3 of 9"), and the same two routes in (Start walks then
// drills, "Quiz me" drills now). What it teaches is a SET — a plain verb and its
// honorific and humble forms — so each row shows the plain verb and the keigo
// words that replace it, with the register each one is. There is no single glyph
// to show and no one Library page a set links to as a character.
//
// WHY NO LOCK CARD
// ================
// Like transitivity, keigo does not wait: a set whose plain verb is not yet
// learned is simply skipped, and the next ready set is taught instead (see
// nextKeigoLesson). So there is nothing to lock — the card is either teaching the
// next ready sets or, when none are ready, absent, exactly like every track
// before its gate opens.

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import { WHY_TRACK } from "@/data/why";
import type { KeigoLesson } from "@/lib/keigo-lesson";
import { positionLabel } from "@/lib/lesson-position";
import type { FactId } from "@/types";

export function NextKeigoLesson({
  lesson,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: KeigoLesson;
  /**
   * Start the lesson. The facts ARE the session — no budget, no length: the
   * unit was decided by the material. `teach: false` is the skip-the-walk route
   * (drill now), the same handler and facts as Start.
   */
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know this", over the sets the button named. */
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  const { position, cards } = lesson;

  return (
    <Card>
      <Lbl>Up next · {positionLabel("keigo sets", position)}</Lbl>

      {/* One compact tile per set, wrapping in a row like the counter and
          grammar cards — the PLAIN verb the learner already knows over a quiet
          "Keigo" tag, which names which set is coming without spoiling the
          honorific/humble forms the walk will teach. A set phrase has no plain
          verb, so it shows the Japanese phrase itself (いらっしゃいませ) — always
          Japanese on the tile, never the English meaning, which the lesson page
          carries. No link — a set has no single glyph; the walk's card has the
          rest. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card) => {
          const glyph = card.plain.length
            ? card.plain.map((p) => p.word).join(" / ")
            : (card.words[0]?.word ?? "");
          return (
            <div
              key={card.entry}
              className="min-w-[112px] flex-1 rounded-lg border border-border px-3 pb-2.5 pt-3 text-center"
            >
              <span className="block font-kana text-[24px] font-extralight leading-[1.2] text-text">
                {glyph}
              </span>
              <span className="mt-1 block text-[11px] tracking-wide text-text-muted/80">
                Keigo
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={() => onClaim(lesson.facts)}>
          I already know{" "}
          {cards.length === 1 ? "this" : `these ${cards.length}`}
        </Btn>
        {/* The two routes in: "Quiz me" drills now, Start walks then drills.
            Both mark these sets seen; only Start shows them to you first. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn onClick={() => onStart(lesson.facts, { teach: false })}>Quiz me</Btn>
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

      {/* Why keigo, and why now — the honorific/humble idea and the gate that
          opens on a plain verb you already know. A pull, so only the lede shows
          until opened. */}
      <WhyDisclosure why={WHY_TRACK.keigo} />
    </Card>
  );
}
