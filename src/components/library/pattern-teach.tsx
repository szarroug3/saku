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
//
// A PATTERN DOES NOT REPRINT ITS FORM'S CONJUGATION ANY MORE
// ==========================================================
// The four verb forms — the て/で-form, the ない-form, the た-form, the stem — now
// each have a Library page of their own, headed by the full conjugation build
// table (te-sequence and its three siblings, the form recipes, KEEP it). A
// PATTERN built on one of those forms (〜てから on the て-form, 〜ないでください on
// the ない-form) is "build that form, then add a tail" — so it no longer shows the
// form's whole conjugation table. It shows only its OWN step, the derive table
// (Verb · Form · Pattern · Meaning), and links to the form's page to build the
// form. `formEntryFor` (data/grammar) is the shared source of truth for which
// patterns this applies to; a pattern on a form with no page (the potential, 〜ば,
// the plain form) is unaffected and keeps whatever autoPatternPage gives it.
//
// THE FOUR WRAP PATTERNS (〜たり〜たり, 〜しか〜ない, 〜は〜より, 〜ほうが〜より) have a
// build LINE but an empty table — autoPatternPage's apply step refuses wraps. The
// build line carries the card; IntroBody renders it, and the (absent) table
// simply does not appear. No empty box, no note about the gap.

import {
  IntroBody,
  IntroBuildFooter,
  IntroBuildFormula,
  IntroBuildTable,
  IntroBuildTableGroup,
  IntroDeriveTable,
} from "@/components/lesson/phase-intro-view";
import { Card, Lbl } from "@/components/ui";
import { autoPatternPage } from "@/data/grammar/auto-page";
import { isFormRecipe } from "@/data/grammar";
import { formLibraryPages } from "@/data/grammar/lessons";
import type { Recipe } from "@/data/grammar/recipes";

export function PatternTeach({ pattern }: { pattern: Recipe }) {
  // A FORM recipe (the て/で-form, ない, た, stem) shows the form's OWN teaching —
  // what it is for AND how to build it — as one stacked card, the same pages the
  // lesson walks (minus lesson-1 scaffolding; see formLibraryPages). A PATTERN
  // built on a form falls through to the build-or-link behaviour below.
  if (isFormRecipe(pattern.id)) {
    // One box PER teaching page: for the て-form that is "what it is for" and
    // "how to build it" as two separate cards; for the single-page forms it is
    // one card. The entry page stacks them and drops the links below.
    return (
      <>
        {formLibraryPages(pattern.id).map((p) => (
          <Card key={p.id} className="h-full">
            <div className="space-y-4">
              {p.eyebrow ? <Lbl>{p.eyebrow}</Lbl> : null}
              <h2 className="text-[15px] font-medium text-text">{p.title}</h2>
              <IntroBody body={p.body} measure="" />
              {p.buildRules?.length ? (
                <IntroBuildTable rules={p.buildRules} heads={p.buildHeads} />
              ) : null}
              {p.buildTables?.map((t, i) => (
                <IntroBuildTableGroup key={i} title={t.title} rules={t.rules} heads={t.heads} />
              ))}
              {p.buildFooter ? <IntroBuildFooter footer={p.buildFooter} /> : null}
              {p.bodyAfterBuild?.length ? <IntroBody body={p.bodyAfterBuild} measure="" /> : null}
            </div>
          </Card>
        ))}
      </>
    );
  }

  // A PATTERN: the same two-box shape a form uses — an intro box (the one-line
  // build summary) and a build box (its whole conjugation, grouped Godan /
  // Ichidan / Exceptions like the て-form, carried through to the finished
  // pattern). The link to the form it builds on rides in the entry's Links box,
  // not here. A wrap (〜たり〜たり) has no table, so only the intro box shows.
  const page = autoPatternPage(pattern);
  const hasBuild = !!(
    page.buildTables?.length ||
    page.buildRules?.length ||
    page.deriveRules?.length
  );
  return (
    <>
      <Card className="h-full">
        <Lbl>How to build it</Lbl>
        <div className="mt-3">
          {page.buildFormula ? (
            <IntroBuildFormula
              base={page.buildFormula.base}
              add={page.buildFormula.add}
              trim={page.buildFormula.trim}
            />
          ) : (
            <IntroBody body={page.body} measure="" />
          )}
        </div>
      </Card>
      {hasBuild ? (
        <Card className="h-full">
          <div className="space-y-5">
            {page.buildTables?.map((t, i) => (
              <IntroBuildTableGroup key={i} title={t.title} rules={t.rules} heads={t.heads} />
            ))}
            {page.buildRules?.length ? (
              <IntroBuildTable rules={page.buildRules} heads={page.buildHeads} />
            ) : null}
            {page.deriveRules?.length ? (
              <IntroDeriveTable rows={page.deriveRules} heads={page.deriveHeads} />
            ) : null}
          </div>
        </Card>
      ) : null}
    </>
  );
}
