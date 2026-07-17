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
import { CHAR_INDEX } from "@/data/characters";

export function TeachScreen({
  chars,
  familiar,
  onStart,
}: {
  chars: string[];
  /** Which of these the app has evidence about — shown before and lost, rather
   * than never met. Presentation only. */
  familiar: (c: string) => boolean;
  onStart: () => void;
}) {
  return (
    <>
      <Card>
        <p className="mb-2 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
          Before you start · {chars.length} to learn
        </p>
        <h1 className="text-[22px] font-light tracking-[-0.3px]">
          Have a look at these first
        </h1>
        <p className="mb-4 mt-0.5 text-[13px] text-text-muted">
          You&rsquo;ll be asked them in a moment. Nothing here is a test.
        </p>

        <div className="flex flex-wrap gap-2">
          {chars.map((c) => {
            const info = CHAR_INDEX[c];
            if (!info) return null;
            return (
              <div
                key={c}
                className="kq-material min-w-[92px] flex-1 rounded-lg border border-border bg-panel px-2 pb-2.5 pt-3 text-center"
              >
                <span className="block text-[30px] font-light leading-[1.2]">
                  {c}
                </span>
                {/* The answer, in full, on purpose. This is the screen's whole
                    job — everywhere else in the app showing this would be
                    giving the game away; here, withholding it would be. */}
                <span className="mt-1 block text-sm text-accent">
                  {info.r[0]}
                </span>
                {familiar(c) ? (
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
          <Btn
            autoFocus
            className="border-transparent bg-text font-medium text-bg hover:bg-text"
            onClick={onStart}
          >
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
