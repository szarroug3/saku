"use client";

// Up next in the transitivity track — the card that teaches the next few verb
// pairs whose two verbs the learner has both already met.
//
// It is the grammar card's cousin: a lesson with no name, a position counted in
// items ("verb pairs 3–6 of 66"), and the same two routes in (Start walks then
// drills, "Quiz me" drills now). Like every card on this page it is a PREVIEW,
// not the lesson: each tile shows the pair's two verbs and a greyed "Verb pair"
// tag, and stops there — the transitive/intransitive split and the readings are
// the lesson's material, taught in the walk, not spoiled on the way in.
//
// WHY NO LOCK CARD
// ================
// Grammar shows a lock when its next pattern needs an unmet word type, because
// grammar is taught in one fixed order and waits. Transitivity does not wait: a
// pair whose verbs are not both learned yet is simply skipped, and the next
// ready pair is taught instead (see nextTransitivityLesson). So there is nothing
// to lock — the card is either teaching the next ready pairs or, when none are
// ready, absent, exactly like every track before its gate opens.

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import { PreviewTile } from "@/components/lesson/preview-tile";
import { WHY_TRACK } from "@/data/why";
import type { TransitivityLesson } from "@/lib/transitivity-lesson";
import { positionLabel } from "@/lib/lesson-position";
import type { FactId } from "@/types";

export function NextTransitivityLesson({
  lesson,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: TransitivityLesson;
  /**
   * Start the lesson. The facts ARE the session — no budget, no length: the
   * unit was decided by the material. `teach: false` is the skip-the-walk route
   * (drill now), the same handler and facts as Start.
   */
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know this", over the pairs the button named. */
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  const { position, cards } = lesson;

  return (
    <Card>
      <Lbl>Up next · {positionLabel("verb pairs", position)}</Lbl>

      {/* A PREVIEW, not the lesson: each tile shows the pair's two verbs and a
          single greyed TYPE line, nothing else. Which one is the "it happens"
          verb and which is the "you do it" verb — and the readings — are the
          lesson's own material, taught in the walk, so they are not shown here.
          The tile says only that a verb pair is coming and which two verbs it is,
          the same way the radical/kanji/word tiles show a glyph and a role. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card) => (
          <PreviewTile
            key={card.entry}
            glyph={`${card.happens.word} · ${card.doIt.word}`}
            type="Verb pair"
            base={22}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={() => onClaim(lesson.facts)}>
          I already know{" "}
          {cards.length === 1 ? "this" : `these ${cards.length}`}
        </Btn>
        {/* The two routes in: "Quiz me" drills now, Start walks then drills.
            Both mark these pairs seen; only Start shows them to you first. */}
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

      {/* Why pairs, and why now — the two-verbs-one-event idea and the gate that
          waits until both verbs are learned. A pull, so only the lede shows
          until opened. */}
      <WhyDisclosure why={WHY_TRACK.transitivity} />
    </Card>
  );
}
