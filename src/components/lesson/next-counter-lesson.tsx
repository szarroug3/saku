"use client";

// Up next — the numbers-and-counters track's lesson card, once kana is done.
//
// It is the words card's twin in what it teaches: a counter is shown OUTRIGHT,
// glyph · reading · meaning, because it is a word built from sounds you already
// have (ひとつ) or a number kanji you have already learned (三本). It is the
// grammar/transitivity card's twin in shape — teach-then-drill, "I already know
// these" beside "Start" — and, like transitivity, it has NO lock card: a form
// whose number kanji is not yet known is skipped, not blocked, so this card is
// either teaching the next ready forms or absent (see counter-lesson.ts).
//
// WHAT IT MAY SAY
// ===============
// Every line is read off the form's own row: how it is written, its reading, its
// gloss, and which counter it is a form of as a quiet tag. A kana form has no
// reading line: its reading IS its glyph, so printing ひとつ · ひとつ would read
// as a bug. It counts COUNTERS, not lessons: "counters 6-10 of 87" — the whole
// of what the track teaches, which does not move, unlike a number of lessons.

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import { WHY_TRACK } from "@/data/why";
import type { CounterLesson } from "@/lib/counter-lesson";
import { positionLabel } from "@/lib/lesson-position";
import type { FactId } from "@/types";

export function NextCounterLesson({
  lesson,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: CounterLesson;
  /**
   * Start the lesson — teach-then-drill. The facts ARE the session: a count was
   * the unit, so there is no budget and no length to apply.
   *
   * `teach: false` is the skip-the-lesson route: drill these counters now,
   * without the walk. Same handler, same facts, same seen record (page.tsx
   * writes it either way); the flag decides only whether the walk happens.
   */
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know these", over the lesson's counters. */
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  const { cards, position } = lesson;
  return (
    <Card>
      {/* "counters" names the track and the items both — unlike grammar, whose
          items are "patterns", a counter IS a counter. */}
      <Lbl>Up next · {positionLabel("counters", position)}</Lbl>

      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card) => (
          <CounterTile key={card.glyph} card={card} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={() => onClaim(lesson.facts)}>
          I already know {cards.length === 1 ? "this" : `these ${cards.length}`}
        </Btn>
        {/* The same two routes the words and grammar cards offer, in the same
            arrangement, because the claim explainer's promise ("skip just the
            lesson and go straight to the quiz") is made once for the whole page
            and has to be true on every card under it. Start walks the counters
            and then drills them; "Quiz me" drills them now. */}
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

      <WhyDisclosure why={WHY_TRACK.counters} />
    </Card>
  );
}

/** One counter, shown glyph · reading · meaning, with its counter as a quiet
 * tag. A kana form has no reading line: it is its own reading, so printing
 * ひとつ · ひとつ reads as a bug. A bare number carries no counter tag. */
function CounterTile({ card }: { card: CounterLesson["cards"][number] }) {
  return (
    <div className="min-w-[112px] flex-1 rounded-lg border border-border px-3 pb-2.5 pt-3 text-center">
      <span className="block font-kana text-[26px] font-extralight leading-[1.2]">
        {card.glyph}
      </span>
      {card.reading ? (
        <span className="mt-0.5 block font-kana text-[13px] text-text-muted">
          {card.reading}
        </span>
      ) : (
        <span className="mt-0.5 block min-h-[16px]" />
      )}
      <span className="mt-1 block text-[13px] text-text">{card.meaning}</span>
      {card.counter ? (
        <span className="mt-1 block text-[10px] uppercase tracking-[0.06em] text-text-muted/80">
          〜{card.counter}
        </span>
      ) : null}
    </div>
  );
}
