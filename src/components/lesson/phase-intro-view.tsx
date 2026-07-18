"use client";

// A teaching card: the step of the walk that explains a CONCEPT rather than a
// character. See src/data/phase-intros.ts for what it says and why it exists.
//
// IT LOOKS LIKE A LESSON PAGE, NOT LIKE A CHARACTER
// ================================================
// Same flat treatment as LessonItemView — it sits directly on the session
// ground, no card around it, because the walk is meant to read as one coherent
// page. But the hero is deliberately NOT a glyph: a phase intro has no
// character to be about, and faking one (a giant が at the top of the dakuten
// card) would say "learn this shape" about a card whose entire point is that
// there is no new shape. So the sentence IS the hero — set at the size the
// glyph would have had, because it is doing the glyph's job.
//
// The eyebrow says what kind of step this is. Without it the reader arriving at
// step 1 of 6 has no way to tell a concept card from a character they somehow
// can't see, and the walk's forward button looks broken rather than patient.

import type { IntroPara, PhaseIntro } from "@/data/phase-intros";

export function PhaseIntroView({ intro }: { intro: PhaseIntro }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
        Before you go on
      </p>

      {/* The claim, at hero size. One sentence; everything below it is the
          working. */}
      <h2 className="mt-3 max-w-[26ch] text-[34px] font-light leading-[1.2] tracking-[-0.4px] text-text">
        {intro.title}
      </h2>

      {/* The body, off the same single light divider the item view uses, so a
          concept step and a character step have the same skeleton and the walk
          doesn't lurch between them. The divider belongs to the STEP, not to the
          paragraphs — it separates the hero sentence from its working — so it
          stays here and IntroBody carries only the paragraphs. */}
      <div className="mt-8 border-t border-border pt-7">
        <IntroBody body={intro.body} />
      </div>
    </div>
  );
}

/**
 * The paragraphs of an intro, and nothing around them.
 *
 * SPLIT OUT SO THE LIBRARY CAN RENDER THE SAME COPY IN A DIFFERENT FRAME. A
 * mark's Library page (src/components/library/mark-view.tsx) shows exactly this
 * teaching — the same sentences, the same mark plates, the same spacing — but it
 * is not a step of a walk, so the eyebrow ("Before you go on") and the hero
 * sentence do not apply to it: nothing is about to go on, and the page already
 * has a title. Everything ABOVE this component is the step; this is the material.
 *
 * The alternative was a `variant` prop on PhaseIntroView, which is one component
 * with two layouts and a growing list of things one caller wants hidden. This is
 * the same split ConversionCard's header argues for, one level smaller.
 */
export function IntroBody({ body }: { body: readonly IntroPara[] }) {
  return (
    <div className="space-y-4">
      {body.map((p, i) => (
        <div key={i} className="flex max-w-[64ch] items-start gap-3">
          {/* The mark the paragraph is about, at a size you can actually see it
              at. ゛ and ゜ are two specks in a run of body text, which is no way
              to introduce the thing the whole card is about. Given a fixed slot
              so the two paragraphs line up under each other and read as a pair
              of marks rather than a pair of sentences. */}
          {p.mark ? (
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-panel"
            >
              {/* Nudged down: a bare mark sits at the top of its em box, so
                  centring the box is not centring the glyph. */}
              <span className="translate-y-[0.3em] font-kana text-[22px] font-light leading-none text-text">
                {p.mark}
              </span>
            </span>
          ) : null}
          <p className="text-[15px] leading-relaxed text-text-muted">
            {p.lead ? <span className="font-medium text-text">{p.lead} </span> : null}
            {p.text}
          </p>
        </div>
      ))}
    </div>
  );
}
