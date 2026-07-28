"use client";

// "How to build it" — the pattern's build card, rendered from the SAME teaching
// the lesson shows.
//
// WHY THIS REPLACED THE OLD RECIPE CARD
// =====================================
// The card used to be PatternRecipe: a dashed-slot formula plus a worked line
// spelt out with kanji verbs (行く / 食べる / 書く). A learner who met the pattern
// in a lesson, then looked it up here, was shown the build TWO different ways —
// the lesson's kana build table (かく・かいて・かいてから) and the Library's kanji
// formula. Two descriptions of one rule diverge, and the divergence is invisible
// until the day they contradict each other. This is the same argument mark-view
// makes for rendering a mark's lesson prose in the Library: there is one copy of
// the teaching, so nothing can drift.
//
// `autoPatternPage(recipe)` is exactly the PhaseIntro the grammar lesson teaches
// the pattern with — kana verbs, grammatical applied meanings — and IntroBody /
// IntroBuildTable / IntroDeriveTable are the very components the lesson's
// PhaseIntroView renders it through. Nothing is retyped, so the Library page and
// the lesson show the same build by construction.
//
// TE-SEQUENCE AND 〜ている go through autoPatternPage too, even though they have
// hand-authored MULTI-PAGE lessons (te-form intro pages, the drill setup). Those
// pages are a lesson's worth of walk; a Library entry card wants the one build
// panel, and autoPatternPage yields it in the same shape as every other pattern
// (te-sequence → the て-form conjugation table; 〜ている → the derivation table).
// So the card is uniform across all 96 patterns rather than special-cased for
// two of them.
//
// THE FOUR WRAP PATTERNS (〜たり〜たり, 〜しか〜ない, 〜は〜より, 〜ほうが〜より) have a
// build LINE but an empty table — autoPatternPage's apply step refuses wraps. The
// build line carries the card; IntroBody renders it, and the (absent) table
// simply does not appear. No empty box, no note about the gap.

import {
  IntroBody,
  IntroBuildTable,
  IntroDeriveTable,
} from "@/components/lesson/phase-intro-view";
import { Card, Lbl } from "@/components/ui";
import { autoPatternPage } from "@/data/grammar/auto-page";
import type { Recipe } from "@/data/grammar/recipes";

export function PatternTeach({ pattern }: { pattern: Recipe }) {
  const page = autoPatternPage(pattern);
  return (
    <Card className="h-full">
      <Lbl>How to build it</Lbl>
      {/* The build blurb, then its table — the same order and the same two blocks
          the lesson's PhaseIntroView stacks (see phase-intro-view.tsx). `measure`
          is dropped because the card is already a sized half-column; a 64ch cap on
          top of that wraps the prose early. */}
      <div className="mt-3 space-y-5">
        <IntroBody body={page.body} measure="" />
        {page.buildRules?.length ? (
          <IntroBuildTable rules={page.buildRules} heads={page.buildHeads} />
        ) : null}
        {page.deriveRules?.length ? (
          <IntroDeriveTable rows={page.deriveRules} heads={page.deriveHeads} />
        ) : null}
      </div>
    </Card>
  );
}
