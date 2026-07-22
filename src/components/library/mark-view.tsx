"use client";

// A MARK'S PAGE — and it is deliberately the least designed page in the Library.
//
// WHAT THIS COMPONENT IS ALLOWED TO DO
// ====================================
// Almost nothing. The owner is choosing per-kind entry-page layouts right now
// and has not decided, so this arranges EXISTING pieces in the plainest honest
// order and invents no chrome: a Card per section with a Lbl on it, which is what
// every other reference surface in this app already looks like. If a mark page
// ends up wanting a layout of its own, it should get one from that decision and
// not from this file having quietly made one first.
//
// EVERY SENTENCE HERE COMES FROM THE LESSON
// =========================================
// `IntroBody` is the component the teach walk renders a phase intro's paragraphs
// with, over the very PhaseIntro objects the walk uses. `ConversionCard` is the
// card the dakuten phase teaches with, over the very DakutenRow objects it
// teaches. Nothing is retyped, so nothing can drift: change the copy in
// src/data/phase-intros.ts and the lesson and this page both change, because
// there is one copy of it.
//
// That is the whole point of the shelf. A learner who was told in a lesson that
// ゛ voices the consonant and then looks up ゛ must not be told something subtly
// different — two descriptions of one rule diverge, and the divergence is
// invisible until the day they contradict each other.
//
// WHY BOTH SCRIPTS, ALWAYS
// ========================
// Each rule is taught twice, once per script, and the Library entry is one page
// for the rule rather than two. The naive fix is to show the hiragana card and
// call the katakana one redundant — which is right for combos, nearly right for
// dakuten, and WRONG for long vowels, where the two scripts genuinely do
// different things (a doubled vowel kana vs one ー). A page that showed only the
// hiragana half of that would teach half a rule. So both, labelled, every time,
// and the near-duplicate cases cost a reader one short scroll.

import { Callout } from "@/components/lesson/callout";
import { ConversionCard } from "@/components/lesson/conversion-card";
import {
  IntroBody,
  IntroExamples,
  PunctuationTable,
} from "@/components/lesson/phase-intro-view";
import { Card, Lbl } from "@/components/ui";
import { bodyFor, scriptLabel, type Mark } from "@/data/marks";

export function MarkView({ mark }: { mark: Mark }) {
  return (
    <>
      {mark.intros.map((intro) => {
        // The paragraphs about THIS mark. For four of the five marks that is all
        // of them; for ゛ and ゜, which share one lesson card, it is the half that
        // is about the one you opened. See `bodyFor`.
        const body = bodyFor(intro, mark.glyph).map((p) =>
          // Drop the paragraph's mark plate on the Library page. The entry header
          // already shows this rule's glyph at 76px directly above, and `bodyFor`
          // only ever keeps paragraphs whose plate IS that glyph (the ゜ half of
          // the dakuten card is filtered out on the ゛ page and vice versa), so
          // every plate that would render here is the header glyph a second time,
          // the same character twice with nothing between them. The plate still
          // earns its place in the teach walk, whose hero is a sentence, not a
          // glyph — there is no header there for it to repeat. Library-only.
          p.mark === mark.glyph ? { ...p, mark: undefined } : p,
        );
        if (body.length === 0) return null;
        const label = scriptLabel(intro.setId);
        return (
          // Prose in one Card, its worked examples in a SEPARATE Card beside it,
          // so the examples read as their own box in the row rather than a panel
          // sunk inside the prose box. A container query drives the split (this
          // column is far narrower than the viewport once the Library sidebar is
          // there, so a viewport breakpoint left it one column with room to
          // spare); it stacks below when the column is genuinely narrow. The
          // threshold is @xl (36rem) to match the walk and to clear the 148px
          // sidebar at ordinary laptop widths. `items-stretch` makes the two
          // Cards share the row's height, so the shorter examples box lines up
          // with the prose rather than floating. The prose passes no `measure`
          // cap: it sits in a sized flex column, and a 64ch cap on top of that
          // was the early word-wrap these pages had.
          <div key={intro.id} className="@container">
            {intro.punctuation?.length ? (
              // Punctuation is a catalogue, so it gets a table Card of the marks
              // with the closing sentence in a Card beneath, rather than the
              // prose-plus-examples split the other marks use.
              <div className="space-y-3.5">
                <Card>
                  {label ? <Lbl>{label}</Lbl> : null}
                  <PunctuationTable rows={intro.punctuation} />
                </Card>
                <Card>
                  <IntroBody body={body} measure="" />
                </Card>
              </div>
            ) : (
              <div className="flex flex-col @xl:flex-row @xl:items-stretch @xl:gap-3.5">
                <Card className="min-w-0 flex-1">
                  {label ? <Lbl>{label}</Lbl> : null}
                  <IntroBody body={body} measure="" />
                </Card>
                {intro.examples?.length ? (
                  <Card className="@xl:w-[20rem] @xl:shrink-0">
                    <IntroExamples examples={intro.examples} bare />
                  </Card>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      {/* The conversion tables, for the two marks that have any. One card each,
          exactly as the lesson steps through them — ConversionCard already
          carries its own heading ("dakuten · one mark, five sounds"), its own
          call-outs and its own speakers, so there is nothing for this file to add
          around it and it does not get any. */}
      {mark.rows.map((row) => (
        <Card key={row.id}>
          <ConversionCard row={row} />
        </Card>
      ))}

      {/* The mark's own aside, in the shared call-out — the same treatment every
          "the rule you just read has a hole in it" remark gets, so this reads as
          an aside about the rule rather than as more of the rule. Only small
          kana has one (ぁぃぅぇぉ); see SMALL_VOWEL_NOTE for why it is a line
          here and not a sixth entry on the shelf. */}
      {mark.note ? (
        <Card>
          <Lbl>Also worth knowing</Lbl>
          <Callout label="The other small kana.">{mark.note}</Callout>
        </Card>
      ) : null}
    </>
  );
}
