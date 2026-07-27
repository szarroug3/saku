"use client";

// Up next in the keigo track — the card that teaches the next few politeness
// sets whose plain verb the learner has already met.
//
// It is the transitivity card's cousin: a lesson with no name, a position counted
// in items ("keigo sets 1-3 of 9"), and the same two routes in (Start walks then
// drills, "Quiz me" drills now). Like every card on this page it is a PREVIEW,
// not the lesson: each tile shows the keigo words the set teaches and a greyed
// "Keigo" tag, and stops there — the honorific/humble split, the registers, the
// readings and the plain verb they replace are the lesson's material, taught in
// the walk, not spelled out on the way in.
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

      {/* A PREVIEW, not the lesson: each tile shows the keigo words the set
          teaches and a single greyed "Keigo" tag, nothing else. Which word is
          honorific and which is humble, the register tags, the readings and the
          plain verb they replace are the lesson's own material, taught in the
          walk — the tile only says that keigo is coming and which words it is. A
          set with no keigo words of its own (a set phrase) shows its label. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card) => (
          <div
            key={card.entry}
            className="min-w-[132px] flex-1 rounded-lg border border-border px-3 pb-2.5 pt-3 text-center"
          >
            <span className="block font-kana text-[20px] font-extralight leading-[1.3] text-text">
              {card.words.length
                ? card.words.map((w) => w.word).join(" · ")
                : "set phrase"}
            </span>
            <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
              Keigo
            </span>
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
