"use client";

// The teach phase, as a full-screen stepped page — the session's OWN teach
// screen, structured like the drill.
//
// WHY THIS REPLACED THE TILE WALL
// ===============================
// A session has two phases: teach, then drill. The drill is a full-screen stage
// — one card at a time under a quiet HUD (see quiz/drill-screen.tsx). The teach
// phase used to be the odd one out: a wall of small tiles showing every fact at
// once. The owner wanted the two to match — "a session page similar to the
// drill" — so the teach phase is now the same shape: the same SessionHud strip
// above (supplied by the /session route), then a centered stage that steps
// through the lesson's items ONE AT A TIME, each a rich detail view (glyph,
// mnemonic, how it's written, readings). Same chrome, same full-screen feel;
// the difference is that here the material is SHOWN, not asked.
//
// STILL SHOWN, NOT ASKED
// ======================
// The teach phase's whole job is unchanged from the tile wall this replaced:
// read the new material, then drill it. Nothing here is graded, and the one
// action that leaves is the same one that always left — Start the round. "Seen
// before" is still a quiet, presentation-only note on material the budget put
// here because you'd forgotten it, never a score.
//
// HOLDS ONLY A STEP
// =================
// Where you are in the walk is not a fact about your memory and is not on the
// session. It is local state, reset on remount — the same call teach-me.tsx made
// and for the same reason. The session's own state (its facts, its round, its
// progress) is untouched, so resume and the Current-lesson nav keep working
// exactly as they did: this changed what the teach phase LOOKS like, not what it
// IS.

import { useMemo, useState } from "react";

import { LessonItemView } from "@/components/lesson/lesson-item-view";
import { Btn, PrimaryBtn } from "@/components/ui";
import { itemsFromFacts } from "@/lib/lesson-items";
import type { FactId } from "@/types";

export function TeachWalk({
  facts,
  familiar,
  onStart,
  reviewing,
}: {
  /** The teach set — what the budget put in front of you before the drill. */
  facts: FactId[];
  /** Which of these you've met before — shown before and forgotten, rather than
   * never met. Presentation only, exactly as the tile wall used it. */
  familiar: (f: FactId) => boolean;
  /** Leave the teach phase for the drill: a fresh round 1, or — when you got
   * here via the drill's "Look again" — a resume of the round in progress. */
  onStart: () => void;
  /** True when reached mid-round via "Look again", so the copy and the button
   * say "back to it" rather than "start". */
  reviewing: boolean;
}) {
  const items = useMemo(() => itemsFromFacts(facts), [facts]);
  const [i, setI] = useState(0);
  const at = Math.min(i, items.length - 1);
  const item = items[at];
  const last = at === items.length - 1;
  const familiarHere = item ? item.facts.some(familiar) : false;

  if (!item) return null;

  return (
    <div className="mx-auto max-w-[560px] px-3 pt-6">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.13em] text-text-muted">
          {reviewing
            ? "Reviewing"
            : `Before you start · ${items.length} to learn`}
        </p>
        <h1 className="mt-1 text-[22px] font-light tracking-[-0.3px]">
          {reviewing ? "A quick look back" : "Have a look at these first"}
        </h1>
        <p className="mt-0.5 text-[13px] text-text-muted">
          {reviewing
            ? "Nothing here is a test — pick up where you left off when you're ready."
            : "You'll be asked them in a moment. Nothing here is a test."}
        </p>
      </div>

      {/* Where you are: the count and the dots, so the walk never hides its own
          length — the same affordance the drill's progress bar gives, sized for
          a handful of items. */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.04em] text-text-muted">
          {at + 1} of {items.length}
          {familiarHere ? (
            <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[9px] tracking-[0.08em] text-text-muted/80">
              seen before
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap justify-end gap-1">
          {items.map((it, n) => (
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

      {/* The item — glyph, mnemonic (kana), how it's written, readings (kanji),
          example words. Keyed on the entry so each step is a clean remount: the
          persisted-preference sections re-read their state and no open/closed
          disclosure leaks between glyphs. */}
      <div className="mt-3 rounded-xl border border-border bg-card p-[18px] kq-material">
        <LessonItemView key={item.entry} item={item} />
      </div>

      {/* Step controls. */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <Btn
          onClick={() => setI(at - 1)}
          disabled={at === 0}
          className="disabled:cursor-default disabled:opacity-40"
        >
          Back
        </Btn>
        <Btn
          go
          onClick={() => setI(at + 1)}
          disabled={last}
          className="disabled:cursor-default disabled:opacity-40"
        >
          Next
        </Btn>
      </div>

      {/* The one action that leaves — begin (or resume) the drill. Available from
          any step: you don't have to page through every item to start, exactly
          as "Start round 1" always was. Full-width and filled, the screen's
          single primary. */}
      <div className="mt-6">
        <PrimaryBtn autoFocus onClick={onStart}>
          {reviewing ? "Back to the drill" : "Start round 1"}
        </PrimaryBtn>
      </div>
    </div>
  );
}
