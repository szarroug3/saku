"use client";

import { Fragment } from "react";

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

import { Callout } from "@/components/lesson/callout";
import { HearButton } from "@/components/ui/hear-button";
import { useFlatSurface } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";
import { hasKanji } from "@/lib/romaji";
import { countGroupHasBuild } from "@/data/phase-intros";
import type {
  CountBuildPiece,
  CountRow,
  IntroBuildRule,
  IntroCountGroup,
  IntroDeriveRow,
  IntroExample,
  IntroPara,
  PhaseIntro,
  PunctuationRow,
  TransitivityPairRow,
} from "@/data/phase-intros";

export function PhaseIntroView({ intro }: { intro: PhaseIntro }) {
  if (intro.sectionTitle && intro.buildSections?.length) {
    return (
      <div className="space-y-7">
        {intro.buildSections.map((section, index) => (
          <IntroBuildSection key={index} {...section} />
        ))}
      </div>
    );
  }
  return (
    <div>
      {/* What kind of step this is. "Before you go on" for a rule that
          interrupts a run of characters; a track intro overrides it, because
          nothing has gone on yet for it to come before. */}
      {!intro.sectionTitle ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
          {intro.eyebrow ?? "Before you go on"}
        </p>
      ) : null}

      {/* The claim, at hero size. One sentence; everything below it is the
          working. */}
      <h2
        className={`${intro.sectionTitle ? "text-accent" : "mt-3 text-text"} max-w-[26ch] text-[34px] font-light leading-[1.2] tracking-[-0.4px]`}
      >
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
          <div className="space-y-6">
            <div className="flex flex-col gap-6 @xl:flex-row @xl:items-start @xl:gap-8">
              <div className="min-w-0 flex-1">
                {intro.buildFormula ? (
                  <IntroBuildFormula
                    base={intro.buildFormula.base}
                    add={intro.buildFormula.add}
                    trim={intro.buildFormula.trim}
                  />
                ) : (
                  // No reading-width cap: the prose fills its column (bounded by
                  // the examples panel beside it, or the page edge when there is
                  // none) and wraps only when it runs out of room, rather than
                  // breaking early at 64ch and leaving the space to its right empty.
                  <IntroBodyWithAnchoredExamples intro={intro} measure="" />
                )}
              </div>
              {intro.examples?.length &&
              intro.examplesAfterBodyIndex === undefined &&
              intro.examplesPlacement !== "below" ? (
                <div className="@xl:w-[20rem] @xl:shrink-0">
                  <IntroExamples examples={intro.examples} />
                </div>
              ) : null}
            </div>
            {intro.examples?.length &&
            intro.examplesAfterBodyIndex === undefined &&
            intro.examplesPlacement === "below" ? (
              <IntroExamples examples={intro.examples} />
            ) : null}
            {intro.countTables?.length ? <IntroCountTables groups={intro.countTables} /> : null}
            {intro.buildRules?.length ? (
              <IntroBuildTable rules={intro.buildRules} heads={intro.buildHeads} />
            ) : null}
            {intro.buildTables?.map((t, i) => (
              <IntroBuildTableGroup key={i} title={t.title} rules={t.rules} heads={t.heads} />
            ))}
            {intro.buildSections?.map((section, index) => (
              <IntroBuildSection key={index} {...section} />
            ))}
            {intro.deriveRules?.length ? (
              <IntroDeriveTable rows={intro.deriveRules} heads={intro.deriveHeads} />
            ) : null}
            {intro.deriveTables?.map((table, index) => (
              <IntroDeriveTableGroup
                key={index}
                title={table.title}
                instruction={table.instruction}
                formula={table.formula}
                rows={table.rules}
                heads={table.heads}
              />
            ))}
            {intro.buildFooter ? <IntroBuildFooter footer={intro.buildFooter} /> : null}
            {intro.bodyAfterBuild?.length ? <IntroBody body={intro.bodyAfterBuild} /> : null}
            {intro.transitivityPairs?.length ? (
              <TransitivityPairsTable rows={intro.transitivityPairs} />
            ) : null}
          </div>
        )}
      </div>

      {/* A hedged aside, shown once at the bottom of the card via the shared
          Callout — the same "Heads up." treatment kana's conversion tables use.
          Kept out of the mt-8 block above so it reads as a caveat about
          everything the card just said, not as one more numbered claim. */}
      {intro.calloutTip ? (
        <div className="mt-6">
          <Callout>{intro.calloutTip}</Callout>
        </div>
      ) : null}
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
        <div key={i}>
          {p.heading ? (
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
              {p.heading}
            </h3>
          ) : null}
          <div className="flex items-start gap-3">
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
            <p className="text-[15px] leading-relaxed text-text">
              {p.lead ? <span className="font-medium text-accent">{p.lead} </span> : null}
              {p.accent && p.text.includes(p.accent)
                ? (() => {
                    const i = p.text.indexOf(p.accent!);
                    return (
                      <>
                        {p.text.slice(0, i)}
                        <span className="text-accent">{p.accent}</span>
                        {p.text.slice(i + p.accent!.length)}
                      </>
                    );
                  })()
                : p.text}
            </p>
          </div>
          {p.examples?.length ? (
            <div className="mt-4">
              <IntroExamples examples={p.examples} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Intro prose with a worked example anchored after one specific paragraph.
 * Most pages keep prose and examples beside each other; adjective classes needs
 * its equation immediately after the な-adjective rule it demonstrates. */
export function IntroBodyWithAnchoredExamples({
  intro,
  measure,
}: {
  intro: PhaseIntro;
  measure?: string;
}) {
  const after = intro.examplesAfterBodyIndex;
  if (after === undefined || !intro.examples?.length) {
    return <IntroBody body={intro.body} measure={measure} />;
  }
  return (
    <div>
      <IntroBody body={intro.body.slice(0, after + 1)} measure={measure} />
      <AnchoredIntroExamples examples={intro.examples} />
      <IntroBody body={intro.body.slice(after + 1)} measure={measure} />
    </div>
  );
}

/** A short equation that belongs to the paragraph directly above it. This is
 * intentionally one inline row rather than the standalone Examples panel used
 * for a whole page's evidence. */
function AnchoredIntroExamples({ examples }: { examples: readonly IntroExample[] }) {
  return (
    <div className="my-4 space-y-2 text-[15px] leading-relaxed">
      {examples.map((ex, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-1.5" lang="ja">
          <span lang="en" className="font-medium text-accent">
            {examples.length === 1 ? "Example:" : `Example ${i + 1}:`}
          </span>
          <span className="text-text">{accentedText(ex.from, ex.accentFrom)}</span>
          <span className="text-text">{ex.op ?? "="}</span>
          <span className="font-medium text-text">{accentedText(ex.to, ex.accentTo)}</span>
          {/* Furigana glosses a kanji reading — an all-kana result has
              nothing for it to add. See SAK-38. */}
          {ex.reading && hasKanji(ex.to) ? (
            <span className="text-[13px] text-text">({ex.reading})</span>
          ) : null}
          <span className="text-text">·</span>
          <span lang="en" className="text-[13px] text-text">
            {ex.gloss}
          </span>
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
/** Highlights the accent substring in accent color, leaving the rest white. */
function accentedText(text: string, accent?: string) {
  if (!accent || !text.includes(accent)) return text;
  const index = text.indexOf(accent);
  return (
    <>
      {text.slice(0, index)}
      <span className="text-accent">{accent}</span>
      {text.slice(index + accent.length)}
    </>
  );
}

export function IntroExamples({
  examples,
  bare = false,
}: {
  examples: readonly IntroExample[];
  bare?: boolean;
}) {
  const { cfg } = useQuizConfig();
  // On a Library entry page (flat) the box is dropped entirely — no border, no
  // fill — so the examples read as a run on the page like every other reference
  // section. The frosty box is kept only in the lesson teach walk, where these
  // sit on the bare session ground and need an edge.
  const flat = useFlatSurface();
  const boxed = !bare && !flat;
  const hasAccent = examples.some((ex) => ex.accentTo || ex.accentFrom);
  const pairGloss = (gloss: string): [string, string] | null => {
    const inner = /\(([^)]+)\)/.exec(gloss)?.[1] ?? gloss;
    const bits = inner.split("→").map((s) => s.trim());
    return bits.length === 2 ? [bits[0], bits[1]] : null;
  };
  return (
    <div className={boxed ? "rounded-lg border border-border bg-panel/40 p-4" : ""}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        Examples
      </p>
      <ul className="mt-3 space-y-2.5">
        {examples.map((ex, i) => (
          <li
            key={i}
            lang="ja"
            className="text-[15px] leading-relaxed"
          >
            {ex.op === "→" && pairGloss(ex.gloss) ? (
              <div className={i === 0 ? "" : "mt-2 border-t border-border/60 pt-2"}>
                {(() => {
                  const [left, right] = pairGloss(ex.gloss)!;
                  return (
                    <>
                      <p className="font-kana text-text">
                        {ex.from}
                        <span className="text-text-muted"> · </span>
                        <span lang="en" className="font-sans text-[13px] text-text-muted">
                          {left}
                        </span>
                      </p>
                      <p className="mt-1 font-kana text-text">
                        {ex.to}
                        <span className="text-text-muted"> · </span>
                        <span lang="en" className="font-sans text-[13px] text-text-muted">
                          {right}
                        </span>
                      </p>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-text">{accentedText(ex.from, ex.accentFrom)}</span>
                {ex.sayFrom ? (
                  <HearButton glyph={ex.sayFrom} voiceName={cfg.voiceName} />
                ) : null}
                <span className="text-text-muted/70">{ex.op ?? "="}</span>
                <span className="font-medium text-text">{accentedText(ex.to, ex.accentTo)}</span>
                {/* Furigana glosses a kanji reading — an all-kana result has
                    nothing for it to add. See SAK-38. */}
                {ex.reading && hasKanji(ex.to) ? (
                  <span className={hasAccent ? "text-text" : "text-[13px] text-text"}>({ex.reading})</span>
                ) : null}
                <span className="text-text-muted/70">·</span>
                <span lang="en" className="text-[13px] text-text">
                  {ex.gloss}
                </span>
                {ex.say ? (
                  <HearButton glyph={ex.say} voiceName={cfg.voiceName} className="ml-1" />
                ) : null}
              </div>
            )}
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
                <span className="flex items-baseline gap-3">
                  <span
                    lang="ja"
                    className="inline-block min-w-[3.5rem] font-kana text-[20px] font-light text-text"
                  >
                    {r.mark}
                  </span>
                  {r.name ? (
                    <span className="text-[13px] text-text-muted">{r.name}</span>
                  ) : null}
                </span>
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

/**
 * A build rule as an equation: `かう − う + って → かって`, the dropped kana greyed
 * and the added one accented so the change reads as a change. The same treatment
 * the te-form build table has always used (lesson-item-view.tsx), lifted here so
 * a grammar teach page can show the transformation instead of describing it. An
 * optional per-row label names the ending(s) the row generalises (う・つ・る).
 */
/** The small (half-size) kana, each mapped to its full-size counterpart. Used to
 * flag a built form that contains one — the small っ of 買って, the small ゃ of a
 * contraction — so a learner doesn't write the full-size character by mistake. */
const SMALL_KANA: Readonly<Record<string, string>> = {
  っ: "つ", ッ: "ツ",
  ゃ: "や", ゅ: "ゆ", ょ: "よ",
  ャ: "ヤ", ュ: "ユ", ョ: "ヨ",
  ぁ: "あ", ぃ: "い", ぅ: "う", ぇ: "え", ぉ: "お",
  ゎ: "わ", ヮ: "ワ",
};

/** A note naming the first small kana in a built form, or null if it has none.
 * Applied automatically to every grammar build row, so any small っ / small ゃ a
 * form introduces is always called out without the author having to remember. */
function smallKanaNote(text: string): string | null {
  for (const ch of text) {
    const big = SMALL_KANA[ch];
    if (big) return `The ${ch} is a small ${ch}, not a full-size ${big}.`;
  }
  return null;
}

/** The inline speaker that rides on a build-table equation's before and after —
 * HearButton at a size that sits inside the 17px kana without crowding it. */
function Say({ glyph, voice }: { glyph: string; voice: string }) {
  return (
    <HearButton
      glyph={glyph}
      voiceName={voice}
      className="ml-1 mr-0.5"
    />
  );
}

export function IntroBuildTable({
  rules,
  heads,
}: {
  rules: readonly IntroBuildRule[];
  heads?: { label?: string; change?: string; note?: string };
}) {
  // One framed table with hairline row separators, not a stack of boxes. Each row
  // is enriched with its built result and a note — an explicit one, else an
  // auto-detected small-kana flag. The label column (left, white) and the notes
  // column (right, muted) each appear only when some row uses them, so a plain
  // single-verb table is not left with empty columns. Every build table carries
  // the same heading row so the related te-form pages read as one format.
  //
  // No Meaning column (SAK-83): the built form is what this table teaches, not
  // the example verb's English gloss — that gloss lives on the verb elsewhere
  // (the Library entry, the lesson card it came from), so repeating it here was
  // just noise next to the conjugation itself.
  const { cfg } = useQuizConfig();
  const rows = rules.map((r) => {
    const verb = r.verb ?? "";
    const stem = r.drop ? verb.slice(0, verb.length - r.drop.length) : verb;
    const result = r.to ?? stem + (r.add ?? "");
    return { r, stem, result, note: r.note ?? smallKanaNote(result) };
  });
  const hasLabels = rules.some((r) => r.label);
  const hasNotes = rows.some((x) => x.note);
  const hasRight = hasNotes;
  const headCell = "px-4 py-2.5 font-semibold";
  const accented = (text: string, accent: string | false | undefined, fallback: boolean) => {
    if (accent === false) return text;
    if (!accent) return fallback ? <span className="text-accent">{text}</span> : text;
    const parts = text.split(accent);
    return parts.map((part, index) => (
      <Fragment key={`${part}-${index}`}>
        {index > 0 ? <span className="text-accent">{accent}</span> : null}
        {part}
      </Fragment>
    ));
  };
  return (
    // overflow-x-auto, not overflow-hidden: on a narrow phone the columns are
    // wider than the screen, so the table scrolls sideways inside its own frame
    // rather than clipping the last column off the edge.
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left" lang="ja">
        <thead>
          <tr
            lang="en"
            className="border-b border-border bg-panel/40 text-[11px] uppercase tracking-[0.1em] text-text-muted"
          >
            {hasLabels ? <th className={headCell}>{heads?.label ?? "Ending"}</th> : null}
            <th className={headCell}>{heads?.change ?? "Change"}</th>
            {hasNotes ? <th className={headCell}>{heads?.note ?? "Note"}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, stem, result, note }) => (
            <tr key={r.verb ?? r.to} className="border-b border-border/60 last:border-0">
              {hasLabels ? (
                <td className="whitespace-nowrap px-4 py-3 align-baseline font-kana text-[14px] text-text">
                  {r.label ?? ""}
                </td>
              ) : null}
              <td
                className={`${hasRight ? "" : "w-full "}whitespace-nowrap px-4 py-3 align-baseline font-kana text-[17px] text-text`}
              >
                {r.to ? (
                  // An irregular verb follows no drop/add rule, so it is shown
                  // whole: する → して. Same table frame, honest shape.
                  <>
                    {accented(r.verb ?? "", r.accent, false)}
                    {r.audio !== false ? <Say glyph={r.verb ?? ""} voice={cfg.voiceName} /> : null}
                    <span className="text-text-muted"> → </span>
                    {accented(r.to, r.accent, true)}
                    {r.audio !== false ? <Say glyph={r.to} voice={cfg.voiceName} /> : null}
                  </>
                ) : (
                  // A drop and/or an add, each shown only when present: a plain
                  // te-form row drops and adds (かう − う + って → かって); an
                  // add-only row just adds (たべて + いる → たべている); a drop-only
                  // row just drops (たべる − る → たべ). A Hear button sits on the
                  // dictionary verb (before) and on the built result (after), so
                  // the sound of the change is a tap away on each side.
                  <>
                    {r.verb}
                    <Say glyph={r.verb ?? ""} voice={cfg.voiceName} />
                    {r.drop ? <span className="text-text-muted"> − {r.drop}</span> : null}
                    {r.add ? (
                      <>
                        <span className="text-text-muted"> + </span>
                        <span className="text-accent">{r.add}</span>
                      </>
                    ) : null}
                    <span className="text-text-muted"> → </span>
                    {stem}
                    {r.add ? <span className="text-accent">{r.add}</span> : null}
                    <Say glyph={result} voice={cfg.voiceName} />
                  </>
                )}
              </td>
              {hasNotes ? (
                <td
                  lang="en"
                  className="w-full min-w-[13rem] px-4 py-3 align-baseline text-[13px] leading-snug text-text-muted"
                >
                  {note ?? ""}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A titled build table — one of several stacked on a page via `buildTables`. The
 * title heads the table (Godan, Ichidan, Exceptions and irregulars) so a page can
 * group distinct rules under their own headings instead of lumping them into one
 * long table. Exported so the Library form page renders the same grouped tables
 * the lesson shows. */
export function IntroBuildTableGroup({
  title,
  rules,
  heads,
}: {
  title: string;
  rules: readonly IntroBuildRule[];
  heads?: { label?: string; change?: string; note?: string };
}) {
  return (
    <div className="space-y-2.5">
      <p lang="en" className="text-[13px] font-semibold text-text">
        {title}
      </p>
      <IntroBuildTable rules={rules} heads={heads} />
    </div>
  );
}

/** One "how it's built" cell — the build pieces joined with " + ", then " → ",
 * then the result. Each numeric piece prints its kana in text colour and its
 * value in parens accent-coloured (じゅう (10)); a bare piece (a counter reading
 * ほん) prints just its kana.
 *
 * A row with NO build pieces is suppletive (〜人's ひとり / ふたり / よにん): there is
 * no derivation to show, so the cell is the count mapping straight to the word —
 * "1 → ひとり", the count accented, no fake "+ にん". */
function CountBuild({
  build,
  result,
}: {
  build: readonly CountBuildPiece[];
  result: CountBuildPiece;
}) {
  const piece = (p: CountBuildPiece) => (
    <>
      {p.kana}
      {p.value ? <span className="text-accent"> ({p.value})</span> : null}
    </>
  );
  if (build.length === 0) {
    return (
      <>
        {result.value ? <span className="text-accent">{result.value}</span> : null}
        <span className="text-text-muted"> → </span>
        {result.kana}
      </>
    );
  }
  return (
    <>
      {build.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="text-text-muted"> + </span> : null}
          {piece(p)}
        </Fragment>
      ))}
      <span className="text-text-muted"> → </span>
      {piece(result)}
    </>
  );
}

/**
 * A table of worked COUNT rows — the number-construction pages' equivalent of the
 * grammar build table, in the same hairline-separated / audio-bearing style.
 * Three columns: the number or count (with its English noun for a counter), the
 * word in kanji with its kana reading and a speaker, and the annotated build
 * equation. Unlike IntroBuildTable it carries a reading column and an accented
 * numeric build, which is why it is a sibling rather than the same component.
 *
 * FRAMELESS: no outer border box — the table sits directly on the page / Card,
 * carried by its header row and the hairline separators between rows. Only the
 * horizontal scroll wrapper remains, so a build column wider than a narrow phone
 * scrolls sideways instead of clipping.
 */
export function IntroCountTable({
  rows,
  counter,
}: {
  rows: readonly CountRow[];
  counter: boolean;
}) {
  const { cfg } = useQuizConfig();
  // The "How it's built" column earns its place only when some row carries a real
  // derivation. An all-suppletive group (〜人's ひとり / ふたり / よにん, every row's
  // build empty) would show only trivial "1 → ひとり" mappings, so the whole column
  // — header and cells — is dropped for it. Detected off the data, not by name.
  const hasBuild = countGroupHasBuild(rows);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" lang="ja">
        <thead>
          <tr
            lang="en"
            className="border-b border-border bg-panel/40 text-[11px] uppercase tracking-[0.1em] text-text-muted"
          >
            <th className="px-4 py-2.5 font-semibold">{counter ? "Counter" : "Number"}</th>
            <th className="px-4 py-2.5 font-semibold">Word</th>
            {hasBuild ? <th className="px-4 py-2.5 font-semibold">How it&rsquo;s built</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              <td
                lang="en"
                className="whitespace-nowrap px-4 py-3 align-baseline text-[14px] leading-snug text-text"
              >
                {row.label}
              </td>
              <td className="whitespace-nowrap px-4 py-3 align-baseline text-[17px] text-text">
                <span className="font-medium text-text">{row.word}</span>
                {/* Furigana glosses a kanji reading — an all-kana word
                    (ひとつ) has nothing for it to add, so the parenthetical
                    reading is dropped entirely; the speaker still plays the
                    sound. See SAK-38. */}
                {hasKanji(row.word) ? (
                  <span className="text-text-muted">
                    ({row.reading}
                    {row.alternateReadings?.map((reading) => (
                      <Fragment key={reading}> / {reading}</Fragment>
                    ))}
                    )
                  </span>
                ) : null}
                <HearButton
                  glyph={row.reading}
                  voiceName={cfg.voiceName}
                  className="ml-1.5"
                />
                {row.alternateReadings?.map((reading) => (
                  <HearButton
                    key={reading}
                    glyph={reading}
                    voiceName={cfg.voiceName}
                    className="ml-1"
                  />
                ))}
              </td>
              {hasBuild ? (
                <td className="w-full whitespace-nowrap px-4 py-3 align-baseline text-[15px] text-text">
                  <CountBuild build={row.build} result={row.result} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The count tables of a construction page or rule card, stacked. The "Regular" /
 * "Irregular" titles are shown ONLY when a page has both groups (the grammar
 * regular-vs-exception split); a page with a single group (the tens, 〜枚, 〜台)
 * renders one untitled table. Both the Library page and the lesson rule card go
 * through here, so the two surfaces cannot drift. */
export function IntroCountTables({ groups }: { groups: readonly IntroCountGroup[] }) {
  const showTitles = groups.length > 1;
  return (
    <div className="space-y-4">
      {groups.map((group, index) =>
        showTitles ? (
          <IntroCountTableGroup
            key={index}
            title={group.title}
            rows={group.examples}
            counter={group.counter}
          />
        ) : (
          <IntroCountTable key={index} rows={group.examples} counter={group.counter} />
        ),
      )}
    </div>
  );
}

/** A titled group of count rows — a "Regular" or "Irregular" table stacked on a
 * construction page, mirroring IntroBuildTableGroup's titled build tables. */
export function IntroCountTableGroup({
  title,
  rows,
  counter,
}: {
  title: string;
  rows: readonly CountRow[];
  counter: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <p lang="en" className="text-[13px] font-semibold text-text">
        {title}
      </p>
      <IntroCountTable rows={rows} counter={counter} />
    </div>
  );
}

/** One complete form-building section: word-type heading, its instruction and
 * optional compact formula, then the examples that demonstrate the rule. */
export function IntroBuildSection({
  title,
  hideTitle = false,
  body,
  formula,
  rules,
  heads,
  tables,
  footer,
}: {
  title: string;
  hideTitle?: boolean;
  body: readonly IntroPara[];
  formula?: { base: string; add?: string; trim?: string };
  rules?: readonly IntroBuildRule[];
  heads?: { label?: string; change?: string; note?: string };
  tables?: readonly {
    title: string;
    rules: readonly IntroBuildRule[];
    heads?: { label?: string; change?: string; note?: string };
  }[];
  footer?: { chain: string; gloss: string };
}) {
  return (
    <section className="space-y-4">
      {!hideTitle ? (
        <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-accent">{title}</h3>
      ) : null}
      <IntroBody body={body} measure="" />
      {formula ? <IntroBuildFormula {...formula} /> : null}
      {rules?.length ? <IntroBuildTable rules={rules} heads={heads} /> : null}
      {tables?.map((table, index) => (
        <IntroBuildTableGroup
          key={index}
          title={table.title}
          rules={table.rules}
          heads={table.heads}
        />
      ))}
      {footer ? <IntroBuildFooter footer={footer} /> : null}
    </section>
  );
}

/** A pattern's build FORMULA: the form it hangs off in a dashed outline, then +
 * the suffix — [ない-form] + でください. The visual "how to build it", shown in place
 * of a prose blurb so the recipe reads at a glance before the example tables. */
export function IntroBuildFormula({
  base,
  add,
  trim,
}: {
  base: string;
  add?: string;
  trim?: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-[17px] text-text">
      <span className="rounded-md border border-dashed border-text-muted/60 px-2.5 py-1">
        {base}
      </span>
      {trim ? (
        <span lang="ja" className="font-kana text-text-muted">
          − {trim}
        </span>
      ) : null}
      {add ? (
        <>
          <span className="text-text-muted">+</span>
          <span lang="ja" className="font-kana text-accent">
            {add}
          </span>
        </>
      ) : null}
    </p>
  );
}

/**
 * A pattern's derivation table: Verb · Form · Pattern · Meaning. Shows the whole
 * chain from the dictionary word to the finished pattern — かく · かき · かきにいく ·
 * "go in order to write" — with the suffix the pattern adds accented in the
 * Pattern column. The Form column drops out when the pattern attaches to the word
 * unchanged (a noun, a plain dictionary form).
 *
 * Each Japanese cell carries a speaker, like the build table's equations: the
 * dictionary verb, its intermediate form, and the finished pattern are three
 * sounds a learner wants to hear said, not just read. The verbs on these pages
 * are kana, so there is always something safe to speak.
 */
export function IntroDeriveTable({
  rows,
  heads,
}: {
  rows: readonly IntroDeriveRow[];
  heads?: { verb?: string; form?: string; pattern?: string };
}) {
  const { cfg } = useQuizConfig();
  const hasForm = rows.some((r) => r.form);
  // The Meaning column earns its place only when the gloss VARIES per row (X
  // filled by each verb: "go to write" / "go to read"). A particle pattern gives
  // every row the same static gloss ("marks the direct object" ×3) — that single
  // meaning is already the page's hero title, so a column repeating it three
  // times is noise. Suppressed when the rows carry one distinct gloss or none.
  const hasGloss = new Set(rows.map((r) => r.gloss).filter(Boolean)).size > 1;
  const headCell = "px-4 py-2.5 font-semibold";
  const jpCell = "whitespace-nowrap px-4 py-3 align-baseline font-kana text-[17px] text-text";
  return (
    // overflow-x-auto, not overflow-hidden: on a narrow phone the columns are
    // wider than the screen, so the table scrolls sideways inside its own frame
    // rather than clipping the last column off the edge.
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left" lang="ja">
        <thead>
          <tr
            lang="en"
            className="border-b border-border bg-panel/40 text-[11px] uppercase tracking-[0.1em] text-text-muted"
          >
            <th className={headCell}>{heads?.verb ?? "Verb"}</th>
            {hasForm ? <th className={headCell}>{heads?.form ?? "Form"}</th> : null}
            <th className={headCell}>{heads?.pattern ?? "Pattern"}</th>
            {hasGloss ? <th className={headCell}>Meaning</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const base = r.form ?? r.verb;
            const suffix = r.result.startsWith(base) ? r.result.slice(base.length) : "";
            const stem = suffix ? r.result.slice(0, r.result.length - suffix.length) : r.result;
            return (
              <tr key={r.verb} className="border-b border-border/60 last:border-0">
                <td className={jpCell}>
                  {r.verb}
                  <Say glyph={r.verb} voice={cfg.voiceName} />
                </td>
                {hasForm ? (
                  <td className={jpCell}>
                    {r.form ?? ""}
                    {r.form ? <Say glyph={r.form} voice={cfg.voiceName} /> : null}
                  </td>
                ) : null}
                <td className={jpCell}>
                  {suffix ? (
                    <>
                      {stem}
                      <span className="text-accent">{suffix}</span>
                    </>
                  ) : (
                    r.result
                  )}
                  <Say glyph={r.result} voice={cfg.voiceName} />
                </td>
                {hasGloss ? (
                  <td
                    lang="en"
                    className="w-full min-w-[10rem] px-4 py-3 align-baseline text-[14px] leading-snug text-text"
                  >
                    {r.gloss ?? ""}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A host-specific derivation section, used when one pattern accepts several
 * kinds of words. Mirrors the titled groups in the て-form build pages. */
export function IntroDeriveTableGroup({
  title,
  instruction,
  formula,
  rows,
  heads,
}: {
  title: string;
  instruction?: string;
  formula?: { base: string; add?: string; trim?: string };
  rows: readonly IntroDeriveRow[];
  heads?: { verb?: string; form?: string; pattern?: string };
}) {
  return (
    <section className="space-y-3.5">
      <h3 className="text-[17px] font-semibold text-accent">{title}</h3>
      {instruction ? <p className="text-[15px] leading-relaxed text-text">{instruction}</p> : null}
      {formula ? <IntroBuildFormula {...formula} /> : null}
      <IntroDeriveTable rows={rows} heads={heads} />
    </section>
  );
}

/** The closing line under a build table: the chain its rows build toward, the
 * Japanese accented and its meaning beneath, set apart so it reads as the result
 * of the steps above rather than another step. Exported so the Library form page
 * can render the same chain the lesson shows. */
export function IntroBuildFooter({ footer }: { footer: { chain: string; gloss: string } }) {
  // Flat on the Library entry page, frosty in the lesson teach walk — see
  // IntroExamples above.
  const flat = useFlatSurface();
  return (
    <div
      className={`rounded-lg border border-border px-4 py-3 ${flat ? "" : "bg-panel/40"}`}
    >
      <p lang="ja" className="font-kana text-[17px] text-accent">
        {footer.chain}
      </p>
      <p lang="en" className="mt-1 text-[14px] text-text-muted">
        {footer.gloss}
      </p>
    </div>
  );
}

function TransitivityPairsTable({ rows }: { rows: readonly TransitivityPairRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-border bg-panel/40 text-[11px] uppercase tracking-[0.1em] text-text-muted">
            <th className="px-4 py-2.5 font-semibold">It happened</th>
            <th className="px-4 py-2.5 font-semibold">Someone did it</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 align-top last:border-0">
              <td className="px-4 py-3 font-kana text-text">{r.happensTail}</td>
              <td className="px-4 py-3 font-kana text-text">{r.doItTail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
