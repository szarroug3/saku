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

import { HearButton } from "@/components/lesson/hear-button";
import { useQuizConfig } from "@/lib/quiz-config";
import type {
  IntroExample,
  IntroPara,
  PhaseIntro,
  PunctuationRow,
} from "@/data/phase-intros";

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
      {/* Prose on the left, its worked examples in a panel on the right, so the
          card reads as a claim beside its evidence and the prose stops wrapping
          early in a half-empty page. A container query (not a viewport
          breakpoint) drives the split: the walk sits in a sized column, so what
          matters is whether THIS column is wide enough for two, not how wide the
          window is. The threshold is @xl (36rem) rather than a larger one because
          the 148px sidebar eats into the walk's width — a bigger breakpoint left
          the card one column at ordinary laptop widths. Stacks below when it is
          not. The Library renders the same two pieces the same way; see
          mark-view.tsx. */}
      <div className="mt-8 border-t border-border pt-7 @container">
        {intro.punctuation?.length ? (
          // Punctuation is a catalogue, not a rule with worked examples, so it
          // reads as a table of the marks with the closing sentence beneath it.
          <div className="space-y-7">
            <PunctuationTable rows={intro.punctuation} />
            <IntroBody body={intro.body} measure="" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 @xl:flex-row @xl:items-start @xl:gap-8">
            <div className="min-w-0 flex-1">
              <IntroBody body={intro.body} />
            </div>
            {intro.examples?.length ? (
              <div className="@xl:w-[20rem] @xl:shrink-0">
                <IntroExamples examples={intro.examples} />
              </div>
            ) : null}
          </div>
        )}
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
 *
 * `measure` caps the reading width. It defaults to a comfortable 64ch for the
 * walk, which sets the prose on the bare session ground; the Library passes its
 * own (or none) because there the prose sits in a sized column beside the
 * examples, and a second cap on top of the column's width was the "plenty of
 * space but the text wraps early" the mark pages had.
 */
export function IntroBody({
  body,
  measure = "max-w-[64ch]",
}: {
  body: readonly IntroPara[];
  measure?: string;
}) {
  return (
    <div className={`space-y-4 ${measure}`}>
      {body.map((p, i) => (
        <div key={i} className="flex items-start gap-3">
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

/**
 * The worked examples for a rule, as scannable formulae: `生 + きる = 生きる
 * (いきる) · to live`. The same facts the prose states, lifted out so the eye
 * can find the words without reading the paragraph.
 *
 * Deliberately plain — a labelled panel of lines, the same treatment every other
 * aside on these pages gets. Each line is one example: its parts on the left, the
 * finished word (with its reading) in the middle, its meaning after a middot.
 *
 * `bare` drops the panel's own frame. The teach walk shows these on the bare
 * session ground, so they need the border/tint to read as a grouped aside. The
 * Library instead gives the examples their OWN Card in the row beside the prose
 * (see mark-view.tsx); a framed panel inside that Card would be a box in a box,
 * so there it renders bare and the Card is the box.
 *
 * An example carrying `say` gets a speaker: the rules on these pages are about
 * SOUNDS (a voicing, a held vowel, a doubled consonant, a fused syllable) and
 * reading "kya" off a page is not hearing it. Examples without `say` — a purely
 * written distinction — stay silent, so the speaker means "there is something to
 * hear here" rather than decorating every line.
 */
export function IntroExamples({
  examples,
  bare = false,
}: {
  examples: readonly IntroExample[];
  bare?: boolean;
}) {
  const { cfg } = useQuizConfig();
  return (
    <div className={bare ? "" : "rounded-lg border border-border bg-panel/40 p-4"}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        Examples
      </p>
      <ul className="mt-3 space-y-2.5">
        {examples.map((ex, i) => (
          <li
            key={i}
            lang="ja"
            className="flex flex-wrap items-baseline gap-x-1.5 text-[15px] leading-relaxed"
          >
            <span className="text-text-muted">{ex.from}</span>
            <span className="text-text-muted/70">{ex.op ?? "="}</span>
            <span className="font-medium text-text">{ex.to}</span>
            {ex.reading ? (
              <span className="text-[13px] text-text-muted">({ex.reading})</span>
            ) : null}
            <span className="text-text-muted/70">·</span>
            <span lang="en" className="text-[13px] text-text-muted">
              {ex.gloss}
            </span>
            {ex.say ? (
              <HearButton
                glyph={ex.say}
                voiceName={cfg.voiceName}
                className="ml-1 self-center"
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The punctuation catalogue as a table: the Japanese mark and its name, the
 * English mark it stands in for, and what it does. Punctuation is a set of marks
 * rather than a rule with worked examples, so it reads as a reference table
 * instead of the prose-plus-examples split every other card uses (see
 * PUNCTUATION in phase-intros.ts). The one genuine rule — no spaces between
 * words — stays as a sentence beneath it.
 */
export function PunctuationTable({ rows }: { rows: readonly PunctuationRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-border bg-panel/40 text-[11px] uppercase tracking-[0.1em] text-text-muted">
            <th className="px-4 py-2.5 font-semibold">Mark</th>
            <th className="px-4 py-2.5 font-semibold">English</th>
            <th className="px-4 py-2.5 font-semibold">What it does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 align-top last:border-0">
              <td className="whitespace-nowrap px-4 py-3">
                <span lang="ja" className="font-kana text-[20px] font-light text-text">
                  {r.mark}
                </span>
                {r.name ? (
                  <span className="ml-2 text-[13px] text-text-muted">{r.name}</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-text-muted">{r.english}</td>
              <td className="px-4 py-3 text-text-muted">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
