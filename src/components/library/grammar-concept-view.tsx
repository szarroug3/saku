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
  IntroBodyWithAnchoredExamples,
  IntroBuildTableGroup,
  IntroExamples,
} from "@/components/lesson/phase-intro-view";
import { Card } from "@/components/ui";
import type { PhaseIntro } from "@/data/phase-intros";

/** What this view actually reads off a GrammarConcept — narrower than the full
 * interface (no `id`, `searchAlso`, `related`) so both the live object and the
 * fetched GrammarConceptEntryView payload satisfy it structurally. */
export interface GrammarConceptViewData {
  readonly name: string;
  readonly body: readonly string[];
  readonly cards: readonly PhaseIntro[];
}

export function GrammarConceptView({
  concept,
  hideTitles = false,
}: {
  concept: GrammarConceptViewData;
  /** Drop each card's h2 title — the redesigned concept ENTRY page carries the
   * concept name in its own header, so a card title like "Godan and Ichidan."
   * beneath it just reads as a second heading. Default false (the router keeps
   * titles). */
  hideTitles?: boolean;
}) {
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

      {concept.cards
        .filter((card) => card.body.length > 0)
        .map((card, index) => {
          // The adjective intro is deliberately the lesson's own page, whose
          // title differs from the Library entry only by a final period. Repeating
          // it as an h2 directly beneath the identical h1 made the reference page
          // look like two pages stacked together. Other cards keep their title.
          const repeatsEntryTitle =
            hideTitles ||
            card.title.replace(/[.!?]+$/, "") === concept.name.replace(/[.!?]+$/, "");
          return (
            // Prose in one Card, its worked examples in a Card beside it, on the
            // container query the mark and term pages settled: the Library column
            // is far narrower than the viewport once the sidebar is there, so what
            // matters is this column's width. Stacks when the column is narrow. A
            // second card (a concept with more than one, e.g. godan/ichidan) opens
            // with the same hairline divider EntrySurface's Section uses.
            <div key={card.id} className={index === 0 ? "@container" : "@container mt-5 border-t border-border/50 pt-5"}>
              <div className="flex flex-col @xl:flex-row @xl:items-stretch @xl:gap-3.5">
                <Card className="min-w-0 flex-1">
                  {/* The card's own title, at reference size — the one line each
                      card is built around, so dropping it would leave two sections
                      with no way to tell them apart. The accent kicker is dropped;
                      the page title already says what this is about. */}
                  {!repeatsEntryTitle ? (
                    <h2 className="mb-3 text-[17px] font-medium leading-snug text-text">
                      {card.title}
                    </h2>
                  ) : null}
                  {/* No `measure` cap: the prose already sits in a sized column,
                      and a second cap on top of it is the early wrap the mark pages
                      had. */}
                  <IntroBodyWithAnchoredExamples intro={card} measure="max-w-[88ch]" />
                  {card.buildTables?.length ? (
                    <div className="mt-6 space-y-6">
                      {card.buildTables.map((table, i) => (
                        <IntroBuildTableGroup
                          key={i}
                          title={table.title}
                          rules={table.rules}
                          heads={table.heads}
                        />
                      ))}
                    </div>
                  ) : null}
                  {card.examples?.length &&
                  card.examplesAfterBodyIndex === undefined &&
                  card.examplesPlacement === "below" ? (
                    <div className="mt-4">
                      <IntroExamples examples={card.examples} />
                    </div>
                  ) : null}
                </Card>
                {card.examples?.length &&
                card.examplesAfterBodyIndex === undefined &&
                card.examplesPlacement !== "below" ? (
                  // Same responsive divider term-view.tsx uses for its prose/
                  // examples pair: a top hairline when stacked narrow, a left
                  // one instead once the row splits into two columns at @xl.
                  <Card className="mt-5 border-t border-border/50 pt-5 @xl:mt-0 @xl:w-[20rem] @xl:shrink-0 @xl:border-t-0 @xl:border-l @xl:pl-4 @xl:pt-0">
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
