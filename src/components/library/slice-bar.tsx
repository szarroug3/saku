"use client";

// THE BAR. Pinned to the bottom of anything you are looking at, offering the
// three things you can do with it: drill it, claim it, file it.
//
// It is one component because it is one bar. A shelf, a section, a search, a
// row and a single entry are all just a `Slice` — a name and some entries — and
// the alternative is three screens each deciding for themselves what "Drill"
// means here. The bar already knows what it is pointing at; the second and third
// verbs are nearly free, which is the whole argument for them existing.
//
// WHAT IT REFUSES TO DO
// =====================
// There are no per-row Drill buttons anywhere in the Library, and this bar is
// why there needn't be. The rule: IF A SCREEN SHOWS YOU THE ANSWER, IT DOESN'T
// GET TO ASK THE QUESTION. The entry page prints セイ two inches above the
// button; a drill of exactly that, right now, is the purest possible massed
// repetition, and the app's own arithmetic scores it at nothing (review() at
// p ≈ 1 multiplies stability by 1.0 — see scoring.ts). So pressing Drill builds
// a NORMAL session that these facts are part of, and they come up at a distance
// from your having read them.

import { useState } from "react";

import { AddToList } from "@/components/library/add-to-list";
import { Btn, Hint } from "@/components/ui";
import {
  drillPlan,
  sliceCount,
  sliceIsDrillable,
  sliceSentence,
  type Slice,
} from "@/lib/library/slice";
import { useQuizSession } from "@/lib/quiz-session";
import type { Claims } from "@/lib/claims";
import type { FactAggregate, FactId } from "@/types";

export function SliceBar({
  slice,
  facts,
  claims,
  now,
  onClaim,
  showLabel = true,
}: {
  slice: Slice;
  facts: Record<FactId, FactAggregate>;
  claims: Claims;
  /** Passed in, never read from a clock here: every screen in this feature
   * renders against ONE `now`, or the bar and the table it summarises can
   * disagree about whether a fact is solid. */
  now: number;
  /** Marks the slice known. Async and owned by the page, because the page holds
   * the history this bar is rendered from and has to refresh it. */
  onClaim(facts: FactId[]): void;
  /** Whether to print `slice.label` in bold ahead of the sentence. True on the
   * shelf, where the label is the current selection or search and nothing else
   * on screen names it. False on an entry page, where the label is the entry's
   * own name and the header and the breadcrumb have both already said it. The
   * label is still PASSED either way: it names the add-to-list panel and the
   * session the Drill button starts. */
  showLabel?: boolean;
}) {
  const { startSession } = useQuizSession();
  const [adding, setAdding] = useState(false);

  const plan = drillPlan(slice, facts, claims, now);
  // Teach first, then probe — the order the session should MEET them, which is
  // budget.planFacts's rule and not this bar's to invent.
  const order = [...plan.teach, ...plan.probe];
  const count = sliceCount(slice, facts, claims, now);
  // ONE thing to learn is not a drill. A single kana IS its one reading, and a
  // "drill" of it is a one-question session that teaches nothing the screen above
  // this bar hasn't already shown — so hide Drill (only Drill) on single-fact
  // slices. Add-to-list and I-know-this stay: you may still file か or claim it.
  const canDrill = sliceIsDrillable(slice);

  return (
    <>
      {adding ? (
        <AddToList
          entries={slice.entries}
          label={slice.label}
          onDone={() => setAdding(false)}
        />
      ) : null}
      {/* `kq-band`, not `kq-material`: this is a sticky band over the page's
          ground and it MUST occlude — the table has to vanish under it, not
          show through it. kq-material would give it the card's frost, which in
          the three opaque themes is nothing at all and in kiri is a 5.5% wash
          the rows read straight through.

          `rounded-(--radius)` rather than `rounded-xl`: the radius+fill recipes
          in globals.css are a real hazard (rounded-xl + bg-card IS the Card),
          and this asks for its material by name instead, so its geometry is
          nobody's business but its own. */}
      <div className="kq-band sticky bottom-0 z-10 mt-3.5 flex flex-wrap items-center gap-3 rounded-(--radius) border border-border p-3 shadow-card">
        <div className="min-w-0 flex-1 text-[13px] text-text-muted">
          {showLabel ? (
            <>
              <b className="font-medium text-text">{slice.label}</b>
              {", "}
            </>
          ) : null}
          {sliceSentence(count)}
          {count.seen > 0 && count.seen < count.total ? (
            <span className="ml-1.5">
              <Hint>
                · {count.seen} seen, {count.total} in total
              </Hint>
            </span>
          ) : null}
        </div>
        <div className="flex flex-none flex-wrap items-center gap-1.5">
          <Btn
            sel={adding}
            onClick={() => setAdding((v) => !v)}
            disabled={slice.entries.length === 0}
          >
            ＋ Add to list
          </Btn>
          <Btn
            onClick={() => onClaim(order)}
            // Claiming what the model already calls solid is a no-op with a
            // confirmation animation. `order` is exactly the not-solid facts,
            // so an empty order means there is nothing left to claim.
            disabled={order.length === 0}
          >
            ✓ I know {slice.entries.length === 1 ? "this" : "these"}
          </Btn>
          {/* startSession, NOT startQuiz. The design settles what this button
              does: "pressing it builds a normal session that these rows are
              only part of, so they come up at a distance from your having read
              them." startQuiz is the one-off; the session loop is the normal
              one, and it is what puts distance between reading セイ here and
              being asked it. */}
          {/* Drill N, and N is now the real number.
              
              It used to be `drillChars(order).length` — the facts filtered down
              to the ones whose subject was kana, because the runtime drilled
              CHARACTERS and CHAR_INDEX has no kanji in it. On 生 that filter
              matched nothing and the button said "Drill 0" next to nine facts,
              with a line underneath admitting the quiz couldn't ask them. The
              runtime is fact-native now, so the filter, the note and the whole
              of src/lib/library/drill.ts are gone: what the model would drill
              and what the quiz can ask are the same list again. */}
          {canDrill ? (
            <Btn
              sel
              disabled={order.length === 0}
              onClick={() => startSession(order, [...plan.teach], slice.label)}
            >
              Drill {order.length}
            </Btn>
          ) : null}
        </div>
      </div>
    </>
  );
}
