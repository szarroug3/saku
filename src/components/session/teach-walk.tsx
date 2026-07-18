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

import { useMemo } from "react";

import { ConversionCard } from "@/components/lesson/conversion-card";
import { LessonItemView } from "@/components/lesson/lesson-item-view";
import { PhaseIntroView } from "@/components/lesson/phase-intro-view";
import { AttributionLink } from "@/components/library/attribution-link";
import { Btn } from "@/components/ui";
import { lessonSteps } from "@/lib/lesson-steps";
import type { FactId } from "@/types";

export function TeachWalk({
  facts,
  familiar,
  onStart,
  wider,
  step,
  onStep,
}: {
  /** The teach set — what the budget put in front of you before the drill. */
  facts: FactId[];
  /** Which of these you've met before — shown before and forgotten, rather than
   * never met. Presentation only, exactly as the tile wall used it. */
  familiar: (f: FactId) => boolean;
  /** Leave the teach phase for the drill now — a fresh round 1, or, when reached
   * mid-round via "Look again", a resume of the round in progress. Either way it
   * lands on the drill. Two controls fire it: the floating bar's escape hatch
   * (session/page.tsx) and, on the last item, the forward button below — see
   * the note there. */
  onStart: () => void;
  /** The WIDER of the two scopes this lesson's drill offers: everything in this
   * script taught up to and including this group. Null when the lesson isn't a
   * kana group (a kanji or word lesson has no script to be cumulative over), and
   * the end of the walk then falls back to the single "Quiz me" it always had. */
  wider?: { label: string; onStart: () => void } | null;
  /** Which item is showing. Lifted to the session page so the top HUD bar can
   * read the position ("N of M") without the walk owning a second copy of it. */
  step: number;
  /** Move to a different item — Back and Next both route through here. */
  onStep: (n: number) => void;
}) {
  // The walk's units. A step is usually a character; where the curriculum
  // changes shape it is a teaching card instead (src/lib/lesson-steps.ts). A
  // lesson with no card produces exactly the item list this used to hold, so
  // everything below — Back/Next, the last-card "Quiz me", the HUD's count —
  // works unchanged for the phases that have none.
  const steps = useMemo(() => lessonSteps(facts), [facts]);
  const at = Math.min(step, steps.length - 1);
  const current = steps[at];
  const last = at === steps.length - 1;
  // "Seen before" is a fact about material you've met. A concept card is not
  // material you can have forgotten, so it never wears the badge.
  const familiarHere =
    current?.type === "item" ? current.item.facts.some(familiar) : false;

  if (!current) return null;

  return (
    <div className="mx-auto max-w-[920px] px-3 pt-6">
      {/* Where you are is the floating bar's job now — it prints "N of M" and
          updates as you step. The row of dots that used to sit here said the
          same thing a second time, less precisely, so it's gone; what's left is
          the quiet "seen before" note when the budget re-surfaced material you'd
          already met. The row keeps its height either way so the item below
          doesn't jump between a familiar step and a new one. */}
      <div className="flex min-h-[1.25rem] items-center gap-3">
        {familiarHere ? (
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-text-muted/80">
            seen before
          </span>
        ) : null}
      </div>

      {/* The item — glyph/picture, the kana hook, how it's written, readings
          (kanji), example words. NO card around it: the lesson is meant to read
          as one coherent page, not a page within a page, so the item sits
          directly on the session ground (the owner's note). Keyed on the entry
          so each step is a clean remount: the persisted-preference sections
          re-read their state and no open/closed disclosure leaks between
          glyphs. */}
      <div className="mt-7">
        {current.type === "intro" ? (
          <PhaseIntroView key={current.key} intro={current.intro} />
        ) : current.type === "conversion" ? (
          <ConversionCard key={current.key} row={current.row} />
        ) : (
          <LessonItemView key={current.key} item={current.item} />
        )}
      </div>

      {/* Step controls, and the end of the walk.

          The forward button is ONE button with two jobs: "Next" while there is
          a next item, "Quiz me" on the last one. There is nothing to advance to
          from the last card, and a disabled Next there was a dead end you had to
          look away from to leave — so the forward action simply becomes the
          finishing action, and paging through the lesson walks you into the
          quiz rather than stopping just short of it.

          The huge full-width "Quiz me" that used to sit under this row is gone.
          Its job — leave from ANY step, without paging through the rest — moved
          up into the floating bar as a small button beside "Done for now", where
          it reads as the escape hatch it always was instead of the screen's
          loudest element. The bar hides it on the last card so the two never say
          "Quiz me" at once (see session/page.tsx). */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Btn
          onClick={() => onStep(at - 1)}
          disabled={at === 0}
          className="disabled:cursor-default disabled:opacity-40"
        >
          Back
        </Btn>
        {/* THE SCOPE FORK. Reaching the end of a kana lesson is a choice, not a
            button: drill the group you were just shown, or drill everything in
            this script you have reached so far. Both are here, at the moment
            the drill actually starts, because that is when the question "how
            hard do I want this to be" is live.

            Two labels and no explanation under them — they say what they do,
            and a paragraph telling you why you might pick each would be longer
            than both. "These only" keeps the accent: it is the lesson's own
            path, and the wider one is an offer rather than a nag. */}
        {last && wider ? (
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={wider.onStart}>{wider.label}</Btn>
            <Btn go autoFocus onClick={onStart}>
              Quiz me on these only
            </Btn>
          </div>
        ) : (
          <Btn go autoFocus onClick={last ? onStart : () => onStep(at + 1)}>
            {last ? "Quiz me" : "Next"}
          </Btn>
        )}
      </div>

      {/* The acknowledgement link — a licence obligation, not decoration. This
          screen shows dictionary data (readings, meanings, example words) AND
          KanjiVG stroke diagrams, so it is exactly the kind of screen from which
          the credits have to be reachable. See attribution-link.tsx. */}
      <AttributionLink />
    </div>
  );
}
