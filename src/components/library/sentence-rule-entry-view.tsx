"use client";

// SENTENCE-RULE teach walk — the in-lesson twin of the Library's sentence-rule
// reference page (sentence-entry-view.tsx, backed by MarkView). SAK-113 moved
// this out of components/session (where it sat as a hand-rolled sibling to
// TeachWalk, never touching ContentItem/buildItem/the Library entry-view
// family) and into components/library, alongside SentenceEntryView,
// TermEntryView and the other entry-view components — the same family
// TeachWalk already renders TermEntryView from directly for grammar-concept/
// term steps, without going through TeachItemView (see teach-walk.tsx).
//
// WHY NOT ROUTE THROUGH TeachItemView / LessonStep LIKE THE OTHER 7 KINDS
// =========================================================================
// TeachItemView dispatches on LessonItem.kind (LessonKind), and LessonStep
// ("intro" | "term" | "conversion" | "item") is built by resolveLessonSteps
// from a teach set's FACTS (src/lib/lesson-steps.ts / lesson-items.ts). A
// sentence-ordering round has no facts at all: it is its own session mode
// (session.snapshot.mode === "assembly", see src/app/session/page.tsx),
// stepping through a single tier's rule by tierId instead of walking a fact
// list. Folding it into LessonStep/resolveLessonSteps would mean inventing
// fake facts for a mode that structurally has none, and reworking the
// assembly round's session plumbing — a much larger, riskier change than the
// content-architecture problem this ticket is about. So this stays a second
// entry point TeachWalk's session-page caller renders directly, exactly the
// way `term` steps render TermEntryView directly — same precedent, same
// reason (a step kind that isn't a glyph/LessonKind item still deserves the
// shared library component family, not a hand-rolled tree).
//
// WHAT DID MOVE
// =============
// (Later, for the Sky lesson: the walk's data and span maths, TIER_EXAMPLES,
// TIER_LESSONS, lessonsForTier and positionedStepParts, moved again to
// src/lib/sentence-rule-walk.ts, a plain module a server-side adapter can
// call. This component renders them exactly as before; TIER_EXAMPLES and
// sentenceRuleEntrySteps are re-exported here for the quiz and the session.)
//
// TIER_EXAMPLES was already the shared corpus: mark-view.tsx has imported it
// from this file (formerly components/session/sentence-ordering-teach-walk.tsx)
// as its authoritative sentence data for years, and the intro card already
// reads the same SENTENCE_ORDERING_GUIDES this file always did (shared with
// the Library and the assembly quiz — see data/sentence-ordering-guides.ts).
// The only things that were genuinely private and duplicated-in-spirit with
// mark-view.tsx were the local rendering helpers below (findChunkStart,
// positionedStepParts, focusedSentence, FocusedPartBoxes) — kept AS IS rather
// than force-merged with mark-view.tsx's own near-identical versions, because
// the two pages render a genuinely different interaction: this walk highlights
// ONE active chunk role per step and grays the rest, while MarkView's
// SentenceRuleExamples colors every role at once on a single static page.
// Unifying those two rendering strategies is a real design decision the owner
// hasn't made (see mark-view.tsx's own "least designed page" header), so it is
// left alone here rather than guessed at.
//
// LEGACY_TIER_GUIDE, which used to live in this file, was dropped: it was
// fully superseded by SENTENCE_ORDERING_GUIDES (sentenceOrderingIntro already
// only ever read the shared guide, never LEGACY_TIER_GUIDE) and had no
// remaining reference anywhere in the app.

import type { ReactNode } from "react";

import { PhaseIntroView } from "@/components/lesson/phase-intro-view";
import { FlatSurfaceProvider } from "@/components/ui";
import type { PhaseIntro } from "@/data/phase-intros";
import {
  CHUNK_ROLE_LABELS,
  SENTENCE_ORDERING_GUIDES,
  sentenceOrderingIntro as sharedSentenceOrderingIntro,
  type SentenceOrderingWorkedExample,
} from "@/data/sentence-ordering-guides";
import {
  lessonsForTier,
  positionedStepParts,
  stepPartOrder,
  type PositionedStepPart,
  type StepKey,
} from "@/lib/sentence-rule-walk";

export type SentenceOrderingTierId =
  | "simple"
  | "conditional"
  | "causal"
  | "obligation"
  | "sequential"
  | "desire"
  | "giving"
  | "reported"
  | "contrast"
  | "request";

// The walk's data lives in src/lib/sentence-rule-walk.ts (plain, callable
// from the server); re-exported here so the assembly quiz and the session
// page keep their imports.
export {
  sentenceRuleEntrySteps,
  TIER_EXAMPLES,
  type TierChunk,
  type TierExample,
} from "@/lib/sentence-rule-walk";

function sentenceOrderingIntro(tierId: SentenceOrderingTierId): PhaseIntro {
  return sharedSentenceOrderingIntro(tierId);
}

function focusedSentence(
  sentence: string,
  spans: readonly PositionedStepPart[],
  activePart: StepKey,
): ReactNode {
  const out: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    if (span.start > cursor) out.push(sentence.slice(cursor, span.start));
    out.push(
      <span
        key={`${span.part}-${span.start}-${index}`}
        className={span.part === activePart ? "font-medium text-accent" : "font-medium text-text-muted"}
      >
        {sentence.slice(span.start, span.end)}
      </span>,
    );
    cursor = span.end;
  });
  if (cursor < sentence.length) out.push(sentence.slice(cursor));
  return out;
}

function FocusedPartBoxes({
  sentence,
  spans,
  activePart,
  labels,
  lang,
}: {
  sentence: string;
  spans: readonly PositionedStepPart[];
  activePart: StepKey;
  labels: Partial<Record<StepKey, string>>;
  lang?: string;
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {spans.map((span) => {
        const active = span.part === activePart;
        return (
          <div
            key={`${span.part}-${span.start}`}
            className="rounded-md border border-border/70 bg-card/60 px-2 py-1"
          >
            <span className={`block text-[9px] font-semibold uppercase tracking-wide ${active ? "text-accent" : "text-text-muted"}`}>
              {labels[span.part]}
            </span>
            <span
              lang={lang}
              className={`text-[13px] font-medium ${active ? "text-accent" : "text-text-muted"}`}
            >
              {sentence.slice(span.start, span.end)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The intro card's own worked example — same three-layer shape as the step
 * cards below it (natural English, that sentence in Japanese word order, then
 * the actual Japanese sentence), just without a part to highlight yet: the
 * intro is read before the walk starts breaking anything into parts. Reuses
 * the step cards' box/label treatment so the abstract description above it
 * and the concrete cards after it don't look like two different features.
 */
function IntroWorkedExample({ example }: { example: SentenceOrderingWorkedExample }) {
  return (
    <div className="mt-6 rounded-md border border-border/60 bg-card/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        Example
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-text">
        Natural English
      </p>
      <p className="text-[14px] text-text-muted">{example.en}</p>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
        English in Japanese order
      </p>
      <p className="text-[13px] text-text-muted">{example.enOrdered}</p>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
        Japanese
      </p>
      <p lang="ja" className="mt-1 text-[20px] font-light text-text-muted">
        {example.jp}
      </p>
    </div>
  );
}
export function SentenceRuleEntryView({
  step,
  tierId = "simple",
}: {
  step: number;
  tierId?: SentenceOrderingTierId;
}) {
  const lessons = lessonsForTier(tierId);
  const intro = sentenceOrderingIntro(tierId);
  const guide = SENTENCE_ORDERING_GUIDES[tierId];
  const totalSteps = 1 + lessons.length;
  const at = Math.max(0, Math.min(step, totalSteps - 1));
  const onIntro = at === 0;
  const lesson = onIntro ? null : lessons[at - 1];

  return (
    <div className="px-3">
      <div className="flex min-h-5 items-center gap-3" />

      <div className="mt-2">
        {onIntro ? (
          // Flat section surfaces, matching the main TeachWalk and the Library
          // entry page: the intro card's flat-aware panels drop their frosty
          // fill in the teach walk too (border kept). Same provider, same reason
          // as teach-walk.tsx.
          <FlatSurfaceProvider>
            <PhaseIntroView intro={intro} />
            {guide.example ? <IntroWorkedExample example={guide.example} /> : null}
          </FlatSurfaceProvider>
        ) : lesson ? (
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                {lesson.step}
              </p>
              <h2 className="mt-3 max-w-[26ch] text-[34px] font-light leading-[1.2] tracking-[-0.4px] text-text">
                {lesson.title}
              </h2>
            </div>

            <div className="border-t border-border pt-7">
              <p className="mb-3 text-[12px] font-semibold text-accent">{guide.hook}</p>
              <div className="space-y-2 text-[15px] leading-relaxed text-text">
                {lesson.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>

              <div className="mt-2 space-y-3">
                {lesson.examples.map(({ example, activePart }, idx) => {
                  const partOrder = stepPartOrder(tierId);
                  const labels = CHUNK_ROLE_LABELS[tierId];
                  const orderedSentence = example.enOrdered.replaceAll(", ", " → ");
                  const naturalParts = positionedStepParts(
                    example.en,
                    example,
                    partOrder,
                    "en",
                  );
                  const orderedParts = positionedStepParts(
                    orderedSentence,
                    example,
                    partOrder,
                    "enOrdered",
                  );
                  const japaneseParts = positionedStepParts(
                    example.jp,
                    example,
                    partOrder,
                    "jp",
                  );
                  return (
                    <div
                      key={`${example.en}-${example.jp}`}
                      className="rounded-md border border-border/60 bg-card/40 px-3 py-2.5"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                        Example {idx + 1}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-text">
                        Natural English
                      </p>
                      <p className="text-[14px] text-text-muted">
                        {focusedSentence(example.en, naturalParts, activePart)}
                      </p>
                      <FocusedPartBoxes
                        sentence={example.en}
                        spans={naturalParts}
                        activePart={activePart}
                        labels={labels}
                      />

                      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
                        English in Japanese order
                      </p>
                      <p className="text-[13px] text-text-muted">
                        {focusedSentence(orderedSentence, orderedParts, activePart)}
                      </p>
                      <FocusedPartBoxes
                        sentence={orderedSentence}
                        spans={orderedParts}
                        activePart={activePart}
                        labels={labels}
                      />

                      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-text">
                        Japanese
                      </p>
                      <p lang="ja" className="mt-1 text-[20px] font-light text-text-muted">
                        {focusedSentence(example.jp, japaneseParts, activePart)}
                      </p>
                      <FocusedPartBoxes
                        sentence={example.jp}
                        spans={japaneseParts}
                        activePart={activePart}
                        labels={labels}
                        lang="ja"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Back / Next, the round config, and the data-attribution link all live in
          the session frame's frozen footer now (see src/app/session/page.tsx). */}
    </div>
  );
}
