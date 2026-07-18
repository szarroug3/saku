"use client";

// Up next — the grammar track's lesson card, once kana is done and beside kanji.
//
// It is the kanji card's twin in shape (teach-then-drill, "I already know these"
// vs "Start"), and the words card's twin in what it teaches: a pattern is shown
// OUTRIGHT, because unlike a glyph it is not an arbitrary shape to be memorised.
// 〜てから is [V-て] + から and means "after doing X" — the card shows the pattern
// and its function, and then the drill checks that you can build it. There is no
// Tofugu guide for "the pattern てから" to point out to, and inventing one would
// be the busy-work the kana/kanji cards send you off-app to avoid.
//
// WHAT IT MAY SAY
// ===============
// Every line is read off the recipe's own row (src/data/grammar/recipes.ts): how
// the pattern is written, its terse functional gloss, and its JLPT level as a
// quiet tag. It does NOT count "lesson N of M": the curriculum's length is fixed
// but a total on the card would read as a promise, so it counts up ("lesson 3")
// the same way the words card does, and does not lie about the end.

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import { WHY_TRACK } from "@/data/why";
import type { GrammarLesson } from "@/lib/grammar-lesson";
import type { FactId } from "@/types";

export function NextGrammarLesson({
  lesson,
  onStart,
  onClaim,
}: {
  lesson: GrammarLesson;
  /** Start the lesson — teach-then-drill. The facts ARE the session: a count
   * was the unit, so there is no budget and no length to apply. */
  onStart: (facts: FactId[]) => void;
  /** "I already know these", over the lesson's patterns. */
  onClaim: (facts: FactId[]) => void;
}) {
  const { cards, index } = lesson;

  return (
    <Card>
      <Lbl>Up next · grammar · lesson {index}</Lbl>

      <h1 className="text-[22px] font-light tracking-[-0.3px]">
        {cards.map((c) => c.gloss).join(" · ")}
      </h1>
      <p className="mt-0.5 text-[13px] text-text-muted">
        Learn {cards.length === 1 ? "this pattern" : "these patterns"}, then a
        quick drill.
      </p>

      {/* The patterns ARE the lesson — shown outright, pattern · gloss, because
          a pattern is a form you already conjugate plus a fixed string. The
          level rides along as a quiet tag: a beginner meets N5 before N4, and
          the card says which is which without making a lesson of it. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card) => (
          <div
            key={card.id}
            className="min-w-[132px] flex-1 rounded-lg border border-border px-3 pb-2.5 pt-3 text-center"
          >
            <span className="block font-kana text-[24px] font-extralight leading-[1.2]">
              {card.pattern}
            </span>
            <span className="mt-1 block text-[13px] text-text">
              {card.gloss}
            </span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.06em] text-text-muted/80">
              {card.level}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={() => onClaim(lesson.facts)}>
          I already know{" "}
          {cards.length === 1 ? "this" : `these ${cards.length}`}
        </Btn>
        <Btn go onClick={() => onStart(lesson.facts)}>
          Start · lesson {index}
        </Btn>
      </div>

      {/* Why grammar, and how it differs from words and kanji — the glue that
          runs alongside them rather than gating on them. Teaching content about
          the language; a pull, so only the lede shows until opened. */}
      <WhyDisclosure why={WHY_TRACK.grammar} />
    </Card>
  );
}
