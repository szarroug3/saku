"use client";

// A TERM'S PAGE — the short answer, and then the app's real explanation of it.
//
// WHAT CHANGED, AND WHY
// =====================
// This used to be one Card of two sentences. The app was meanwhile teaching most
// of these same words properly, in a concept card with four developed paragraphs
// and its worked examples, and a reader who looked "Kanji" up in the Library got
// the thin version while the lesson had the written one. So the page now renders
// the CARD ITSELF, from the very PhaseIntro objects the teach walk renders (see
// `cards` in src/data/terms.ts). Nothing is retyped here: change a card's copy in
// src/data/track-intros.ts or src/data/phase-intros.ts and this page changes with
// it, because there is one copy of the words.
//
// That is the same arrangement mark-view.tsx already makes for the Writing rules
// shelf, for the same reason, and it uses the same two pieces to do it —
// `IntroBody` and `IntroExamples` are exported from phase-intro-view.tsx exactly
// so a Library page can put the lesson's material in a Library frame.
//
// IT IS NOT A LESSON STEP AND MUST NOT LOOK LIKE ONE
// ==================================================
// PhaseIntroView draws a card as a STEP OF A WALK: an accent-coloured kicker
// ("What kanji are") over a 34px hero sentence, sitting on the bare session
// ground with no box, because the walk is one page you are being led through. A
// reference page is not being led through — it has a header of its own a few
// inches up, it is scrolled and scanned, and a full-bleed hero dropped into it
// would read as the lesson having leaked. So the hero sentence comes down to a
// section heading, the kicker is dropped (the page's own title already says what
// this is about), and each card becomes a Card, which is what every other
// reference surface in this app looks like.
//
// A TERM WITH NO CARD IS SIX OF THE EIGHTEEN, AND SAYS NOTHING ABOUT IT
// =====================================================================
// romaji, furigana, JLPT, particle, pitch accent and mora name things the app
// uses but never teaches a card about. Their pages are the definition Card and
// then the page ends, exactly as every term page did before this file grew. No
// heading with nothing under it and no line apologising for the gap: a third of
// the shelf carrying "there is no lesson for this one" would be the app narrating
// its own coverage on every other page.

import {
  IntroBody,
  IntroExamples,
} from "@/components/lesson/phase-intro-view";
import { Card, Lbl } from "@/components/ui";
import { bodyFor, scriptLabel } from "@/data/marks";
import type { Term } from "@/data/terms";

export function TermView({ term }: { term: Term }) {
  return (
    <>
      {/* The short answer, and ONLY when nothing better follows it. The entry
          header above already prints the one-line summary, so on a term that
          carries a card this body was a third telling of the same thing, and the
          weakest of the three: "Kanji are the characters Japanese borrowed from
          Chinese" directly above a card that says it properly and at length. A
          term with no card keeps it, because there it IS the page. */}
      {(term.cards ?? []).length === 0 ? (
        <Card>
          <div className="space-y-2.5 text-[15px] leading-relaxed">
            {term.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </Card>
      ) : null}

      {(term.cards ?? []).map((card, _i, cards) => {
        // The paragraphs about THIS word. The identity for eleven of the twelve;
        // only ゛ and ゜ share a card and need the split. See `cardMark`.
        const body = term.cardMark ? bodyFor(card, term.cardMark) : card.body;
        if (body.length === 0) return null;
        // "In hiragana" / "In katakana", and nothing at all for a card that
        // belongs to no script. ONLY WHEN THERE ARE TWO CARDS, which is the only
        // case it says anything: on kana, dakuten, handakuten and yōon it is what
        // tells the two halves apart, while on the Hiragana page a lone card
        // labelled "In hiragana" is the page's own title in smaller type.
        const label = cards.length > 1 ? scriptLabel(card.setId) : null;
        return (
          // Prose in one Card, its worked examples in a Card beside it, on the
          // container query mark-view.tsx settled: the Library column is far
          // narrower than the viewport once the sidebar is there, so what matters
          // is this column's width. Stacks when the column is genuinely narrow.
          <div key={card.id} className="@container">
            <div className="flex flex-col @xl:flex-row @xl:items-stretch @xl:gap-3.5">
              <Card className="min-w-0 flex-1">
                {label ? <Lbl>{label}</Lbl> : null}
                {/* The card's own title, at reference size. It is the one line
                    the card is built around, so dropping it would lose the point
                    of every card and leave three okurigana sections with no way
                    to tell them apart. */}
                <h2 className="mb-3 text-[17px] font-medium leading-snug text-text">
                  {card.title}
                </h2>
                {/* No `measure` cap: the prose already sits in a sized column,
                    and a second cap on top of it is the early wrap the mark
                    pages had. */}
                <IntroBody body={body} measure="" />
              </Card>
              {card.examples?.length ? (
                <Card className="@xl:w-[20rem] @xl:shrink-0">
                  <IntroExamples examples={card.examples} bare />
                </Card>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
