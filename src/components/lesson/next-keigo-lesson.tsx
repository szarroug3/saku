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

      {/* Each set as a row: the plain verb the learner knows, then the keigo
          words that replace it, each tagged with its register. No link — a set
          has no single glyph; the walk-through's card carries the rest. */}
      <div className="mt-4 space-y-2">
        {cards.map((card) => (
          <div key={card.entry} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[13px] text-text-muted">Plain:</span>
              {card.plain.length ? (
                <span className="font-kana text-[18px] font-extralight leading-none text-text">
                  {card.plain.map((p) => p.word).join(" / ")}
                </span>
              ) : (
                <span className="text-[13px] text-text-muted">set phrase</span>
              )}
              <span className="text-[12px] text-text-muted">— {card.meaning}</span>
            </div>
            <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-4">
              {card.words.map((w) => (
                <div key={w.word} className="flex items-baseline gap-2">
                  <span className="font-kana text-[20px] font-extralight leading-none text-text">
                    {w.word}
                  </span>
                  <span className="font-kana text-[12px] text-text-muted">
                    {w.reading}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-text-muted">
                    {w.register}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
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
