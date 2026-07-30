"use client";

// A GRAMMAR CONCEPT'S PAGE — the idea a lesson teaches, in a reference frame.
//
// It is the term page's twin (see term-view.tsx), for the same reason and built
// from the same pieces. The app already teaches the て-form as an idea, in the
// lesson's concept cards; this page renders THOSE cards — the very PhaseIntro
// objects the teach walk renders — through the lesson's own IntroBody, so the
// reference and the lesson say one set of words and cannot drift.
//
// NOT A LESSON STEP. PhaseIntroView draws a card as a step of a walk: an
// accent kicker over a 34px hero on the bare session ground. A reference page has
// a header of its own a few inches up and is scanned, not led through, so the
// card's hero comes down to a section heading and each card becomes a Card — the
// same reframing term-view.tsx makes.

import {
  IntroBody,
  IntroExamples,
} from "@/components/lesson/phase-intro-view";
import { Card } from "@/components/ui";
import type { GrammarConcept } from "@/data/grammar-concepts";

export function GrammarConceptView({ concept }: { concept: GrammarConcept }) {
  return (
    <>
      {/* The short answer, and ONLY when no card follows it. The entry header
          above already prints the one-line summary, so on a concept that carries
          cards this body would be a third telling of the same idea. A concept
          with no card keeps it, because there it IS the page. */}
      {concept.cards.length === 0 ? (
        <Card>
          <div className="space-y-2.5 text-[15px] leading-relaxed">
            {concept.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </Card>
      ) : null}

      {concept.cards.map((card) => {
        if (card.body.length === 0) return null;
        return (
          // Prose in one Card, its worked examples in a Card beside it, on the
          // container query the mark and term pages settled: the Library column
          // is far narrower than the viewport once the sidebar is there, so what
          // matters is this column's width. Stacks when the column is narrow.
          <div key={card.id} className="@container">
            <div className="flex flex-col @xl:flex-row @xl:items-stretch @xl:gap-3.5">
              <Card className="min-w-0 flex-1">
                {/* The card's own title, at reference size — the one line each
                    card is built around, so dropping it would leave two sections
                    with no way to tell them apart. The accent kicker is dropped;
                    the page title already says what this is about. */}
                <h2 className="mb-3 text-[17px] font-medium leading-snug text-text">
                  {card.title}
                </h2>
                {/* No `measure` cap: the prose already sits in a sized column,
                    and a second cap on top of it is the early wrap the mark pages
                    had. */}
                <IntroBody body={card.body} measure="" />
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
