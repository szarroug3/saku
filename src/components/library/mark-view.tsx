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
import { IntroBody } from "@/components/lesson/phase-intro-view";
import { Card, Lbl } from "@/components/ui";
import { bodyFor, type Mark } from "@/data/marks";

/** "hiragana" → "In hiragana". The intro already carries which script it belongs
 * to; this only puts a word on it. A script-neutral card (setId "") belongs to no
 * script and gets NO label at all rather than an empty pill — see NO_SCRIPT in
 * src/data/phase-intros.ts. Anything else is a set id we do not ship, printed
 * as-is rather than mapped to a guess. */
function scriptLabel(setId: string): string | null {
  if (setId === "hiragana") return "In hiragana";
  if (setId === "katakana") return "In katakana";
  if (setId === "") return null;
  return setId;
}

export function MarkView({ mark }: { mark: Mark }) {
  return (
    <>
      {mark.intros.map((intro) => {
        // The paragraphs about THIS mark. For four of the five marks that is all
        // of them; for ゛ and ゜, which share one lesson card, it is the half that
        // is about the one you opened. See `bodyFor`.
        const body = bodyFor(intro, mark.glyph);
        if (body.length === 0) return null;
        const label = scriptLabel(intro.setId);
        return (
          <Card key={intro.id}>
            {label ? <Lbl>{label}</Lbl> : null}
            <IntroBody body={body} />
          </Card>
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
