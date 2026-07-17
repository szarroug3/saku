"use client";

// New material: SHOWN, not asked.
//
// WHY THIS SCREEN EXISTS
// ======================
// The ranking model sends anything at p → 0 to "teach" rather than ranking it,
// and that includes both things you've never seen and things you've
// comprehensively forgotten — which are the same state, by the same
// arithmetic, and the model deliberately can't tell them apart.
//
// The rule for all of them is the same: don't ask a question you already
// predict they'll fail. It teaches nothing that showing the answer wouldn't,
// and a wrong answer to something you were never taught is not evidence about
// your memory — it's evidence about the app. (It is the same principle that
// makes `weakness` peak at p = 0.5 instead of p = 0: a foregone conclusion is
// not worth asking, and the model is not interested in one either.)
//
// So these are read, then drilled. The drill that follows is the same drill as
// everything else — this screen buys the first attempt a chance of being right,
// which is all it is for.
//
// NEW VS LOST IS PRESENTATION, NOT SCHEDULING
// ===========================================
// The budget doesn't distinguish them and mustn't. This screen may, gently,
// because "you've had this before" is a true and useful thing to read next to
// a character you don't recognise — but it changes nothing about what happens
// next, and it never says how long ago or how badly. That would be a debt, and
// a debt is the thing the whole app refuses to keep.

import { Btn, Card, Hint } from "@/components/ui";
import { questionsFor } from "@/lib/engine/question";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

export function TeachScreen({
  facts,
  familiar,
  onStart,
}: {
  facts: FactId[];
  /** Which of these the app has evidence about — shown before and lost, rather
   * than never met. Presentation only. */
  familiar: (f: FactId) => boolean;
  onStart: () => void;
}) {
  return (
    <>
      <Card>
        <p className="mb-2 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
          Before you start · {facts.length} to learn
        </p>
        <h1 className="text-[22px] font-light tracking-[-0.3px]">
          Have a look at these first
        </h1>
        <p className="mb-4 mt-0.5 text-[13px] text-text-muted">
          You&rsquo;ll be asked them in a moment. Nothing here is a test.
        </p>

        <div className="flex flex-wrap gap-2">
          {facts.map((f) => {
            const info = factInfo(f);
            if (!info) return null;
            // The SAME seam the drill screen asks through — so what you are
            // shown here and what you are asked in a moment cannot drift. A
            // teach card that rendered its own glyph would be a second opinion
            // about what the question is.
            const p = questionsFor(f).prompt(f, "jp2en");
            return (
              <div
                key={f}
                className="kq-material min-w-[92px] flex-1 rounded-lg border border-border bg-panel px-2 pb-2.5 pt-3 text-center"
              >
                {/* Sized off `jp` the same way the drill screen sizes its
                    halo: an English meaning set at 30px is a wall of text
                    where a glyph was. */}
                <span
                  className={
                    p.jp
                      ? "block text-[30px] font-light leading-[1.2]"
                      : "block text-[15px] font-light leading-[1.35]"
                  }
                >
                  {p.glyph}
                </span>
                {/* Not decoration — the same line that makes the QUESTION
                    gradeable (see engine/question.ts). "生" taught bare, then
                    asked "生 · in 人生", teaches the wrong thing: nine readings
                    where the question wants one. */}
                {p.context ? (
                  <span className="mt-0.5 block text-[11px] text-text-muted">
                    {p.context}
                  </span>
                ) : null}
                {/* The answer, in full, on purpose. This is the screen's whole
                    job — everywhere else in the app showing this would be
                    giving the game away; here, withholding it would be. */}
                <span className="mt-1 block text-sm text-accent">
                  {info.answers[0]}
                </span>
                {familiar(f) ? (
                  <span className="mt-1 block text-[9px] uppercase tracking-[0.08em] text-text-muted/70">
                    seen before
                  </span>
                ) : (
                  <span className="mt-1 block min-h-[11px]" />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          {/* `go`, not a className. This button spent its life rendering --text
              on --text — see Btn: the tone arrived as `text-bg` alongside the
              branch's own `text-text`, and lost. */}
          <Btn autoFocus go onClick={onStart}>
            Start round 1
          </Btn>
        </div>
      </Card>

      <Card className="px-[15px] py-[13px]">
        <Hint>
          These are in the session because the app has nothing to go on for them
          — either you haven&rsquo;t seen them, or it&rsquo;s been long enough
          that it can&rsquo;t tell.
        </Hint>
      </Card>
    </>
  );
}
