"use client";

// Teach me here — the whole of the in-app kana lesson, and deliberately almost
// nothing.
//
// WHY IT IS THIS SMALL
// ====================
// The app points kana at Tofugu because Tofugu teaches with mnemonics and the
// app does not (see next-lesson.tsx and LEARN_LINKS). Tofugu stays the
// recommended path. This is the other kind of learner — the one who reads あ=a
// once and has it, and for whom a mnemonic about a nun chasing an alligator is
// friction, not help. So this shows the glyph and its reading, lets you step,
// and stops. NO quiz — the drill is the "Quiz me" button below, a separate,
// explicit act. NO mnemonics — that is the thing Tofugu is for and this is not.
// NO stroke order — that is a third feature, not this one.
//
// It reads everything off `src/data/characters.ts`, the same source the card
// above it counts: a group is its characters and each character carries its
// readings, so there is nothing to write per group and nothing to keep in step.
//
// It holds its own step and no more — where you are in the walkthrough is not a
// fact about your memory and does not belong in history. Close the card and the
// walkthrough forgets where you were, which is correct: it taught you nothing
// the model needs to remember, on purpose.

import { useState } from "react";

import { Btn } from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
import { useQuizConfig } from "@/lib/quiz-config";
import { speak } from "@/lib/speech";

export function TeachMe({ chars }: { chars: string[] }) {
  const { cfg } = useQuizConfig();
  const [i, setI] = useState(0);
  const total = chars.length;
  const at = Math.min(i, total - 1);
  const char = chars[at];
  const reading = CHAR_INDEX[char]?.r[0] ?? "";
  const last = at === total - 1;

  return (
    <div className="kq-material mt-3 rounded-lg border border-border bg-panel px-3.5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.04em] text-text-muted">
          {at + 1} of {total}
        </p>
        {/* Where you are, as dots — a group is five-ish characters, so the whole
            shape fits on one line and the walkthrough never hides its own
            length. */}
        <div className="flex gap-1">
          {chars.map((c, n) => (
            <span
              key={c}
              className={
                n === at
                  ? "size-1.5 rounded-full bg-text"
                  : "size-1.5 rounded-full bg-border"
              }
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center py-5">
        <p className="font-kana text-[64px] font-extralight leading-none">
          {char}
        </p>
        <p className="mt-3 text-[15px] text-text-muted">{reading}</p>
        {/* One speaker, nothing more (this card is deliberately minimal — see the
            header). Kana always has a sound, so it always shows. `type="button"`
            keeps it off Next/Back; it never takes autoFocus, so Next stays the
            key target. */}
        <button
          type="button"
          onClick={() => speak(char, cfg.voiceName)}
          aria-label={`Hear ${char}`}
          className="mt-3 cursor-pointer rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] leading-none text-text-muted hover:bg-panel hover:text-text"
        >
          🔊
        </button>
      </div>

      <div className="flex items-center justify-between">
        <Btn
          onClick={() => setI(at - 1)}
          disabled={at === 0}
          className="disabled:cursor-default disabled:opacity-40"
        >
          Back
        </Btn>
        {last ? (
          <span className="text-xs text-text-muted">
            That&rsquo;s the group. Quiz yourself below when you&rsquo;re ready.
          </span>
        ) : (
          <Btn go onClick={() => setI(at + 1)}>
            Next
          </Btn>
        )}
      </div>
    </div>
  );
}
