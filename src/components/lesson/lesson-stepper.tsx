"use client";

// The stepped lesson: walk a lesson's items one at a time, and the three intents
// that end it.
//
// WHAT SURVIVED FROM THE INLINE WALKTHROUGH
// =========================================
// The old inline "Teach me here" (teach-me.tsx) stepped kana with Back/Next and
// stopped. This is that walk, made a page and made rich, and carrying the intents
// that used to live on the lesson CARD around it — so nothing was lost in the
// move, only gathered into one place:
//
//   Quiz me            marks the whole lesson SEEN and drops into the drill.
//   I already know…    claims the lesson (skips the drill) — group-wide, and,
//                      for kana, the wider "I know all hiragana".
//   I already know this the per-ITEM claim: this one glyph, right here, without
//                      leaving the walk.
//
// HOLDS ONLY A STEP, LIKE ITS PREDECESSOR
// =======================================
// Where you are in the walk is not a fact about your memory and does not belong
// on disk — the same reasoning teach-me.tsx wrote down. So the only state here is
// the step index, clamped to the items that remain. Claiming an item removes it
// (the plan is a view of history, refreshed by the page), the list shrinks under
// the same index, and the walk simply continues on the next glyph.

import { useState } from "react";

import { WhyDisclosure } from "@/components/lesson/why";
import { LessonItemView } from "@/components/lesson/lesson-item-view";
import { Btn, Card } from "@/components/ui";
import type { LessonItem, LessonPlan } from "@/lib/lesson-items";
import type { FactId } from "@/types";

export function LessonStepper({
  plan,
  onQuizMe,
  onClaimGroup,
  onClaimItem,
}: {
  plan: LessonPlan;
  /** "Quiz me" — mark the remaining lesson seen and drill it. */
  onQuizMe: (facts: FactId[]) => void;
  /** "I already know these" — claim a set (the remaining lesson, or the wider
   * "all hiragana") and skip the drill. */
  onClaimGroup: (facts: FactId[]) => void;
  /** The per-item claim — this glyph alone, staying in the walk. */
  onClaimItem: (item: LessonItem) => void;
}) {
  const total = plan.items.length;
  const [i, setI] = useState(0);
  // Clamp rather than trust: the plan shrinks when an item is claimed, and the
  // index that pointed at the last item would fall off the end. Staying put
  // after a claim lands you on what was the NEXT glyph, which is the walk
  // continuing — exactly what you'd want.
  const at = Math.min(i, total - 1);
  const item = plan.items[at];
  const last = at === total - 1;

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.06em] text-text-muted">
              {plan.sub}
            </p>
            <h1 className="mt-0.5 text-[22px] font-light tracking-[-0.3px]">
              {plan.label}
            </h1>
          </div>
          {plan.learn ? (
            <a
              href={plan.learn.url}
              target="_blank"
              rel="noopener noreferrer"
              className="kq-material shrink-0 cursor-pointer rounded-lg border border-border bg-card px-3 py-[6px] text-[12px] text-text no-underline hover:bg-panel"
            >
              {plan.learn.label} ↗
            </a>
          ) : null}
        </div>

        {/* A single indivisible kanji bundle bigger than the usual lesson — the
            card says so rather than let the length quietly lie. */}
        {plan.over ? (
          <p className="mt-3 rounded-lg border border-border bg-panel px-3 py-2 text-[12px] text-text-muted">
            This one&rsquo;s bigger than a usual lesson and can&rsquo;t be split —
            take it in one go.
          </p>
        ) : null}

        {/* Where you are: the count and the dots, so the walk never hides its
            own length. */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.04em] text-text-muted">
            {at + 1} of {total}
          </p>
          <div className="flex flex-wrap justify-end gap-1">
            {plan.items.map((it, n) => (
              <button
                key={it.entry}
                type="button"
                aria-label={`Go to ${it.glyph}`}
                aria-current={n === at}
                onClick={() => setI(n)}
                className={`size-1.5 rounded-full ${
                  n === at ? "bg-text" : "bg-border hover:bg-text-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* The item itself — glyph, mnemonic (kana), how it's written, readings
            (kanji), example words. Keyed on the entry so each step is a clean
            remount: the persisted-preference sections re-read their state, and no
            open/closed disclosure leaks from one glyph to the next. */}
        <div className="mt-3 border-t border-border pt-3">
          <LessonItemView key={item.entry} item={item} />
        </div>

        {/* Step controls, with the per-item claim between them. */}
        <div className="mt-5 flex items-center justify-between gap-2">
          <Btn
            onClick={() => setI(at - 1)}
            disabled={at === 0}
            className="disabled:cursor-default disabled:opacity-40"
          >
            Back
          </Btn>
          <Btn onClick={() => onClaimItem(item)}>I already know this</Btn>
          <Btn
            go
            onClick={() => setI(at + 1)}
            disabled={last}
            className="disabled:cursor-default disabled:opacity-40"
          >
            Next
          </Btn>
        </div>

        {/* The track's "why?" — why this material comes when it does. One honest
            line, the rest behind the pull. */}
        {plan.why ? <WhyDisclosure why={plan.why} /> : null}
      </Card>

      {/* The two group intents that END the walk, kept apart because they route
          apart — the same split the lesson cards make. Quiz me drills; claiming
          skips. Always on screen, so you can commit from any step. */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Btn onClick={() => onClaimGroup(plan.facts)}>
              I already know {total === 1 ? "this" : `these ${total}`}
            </Btn>
            {plan.claimAll ? (
              <Btn onClick={() => onClaimGroup(plan.claimAll!.facts)}>
                {plan.claimAll.label}
              </Btn>
            ) : null}
          </div>
          <Btn go onClick={() => onQuizMe(plan.facts)}>
            Quiz me
          </Btn>
        </div>
        <p className="mt-3 border-t border-border pt-2.5 text-[12px] leading-relaxed text-text-muted">
          Quiz me adds these to your knowledge base and starts a drill — the drill
          keeps the score. Saying you already know them adds them too, but skips
          the drill and takes them out of your way.
        </p>
      </Card>
    </>
  );
}
