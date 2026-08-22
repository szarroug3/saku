"use client";

// SAK-131: the typed-answer input box — shared between the live drill
// (drill-screen.tsx, where it's editable and wired to the engine) and the
// /dev/quiz-gallery static preview (page.tsx's old local `TypedBox`, which
// hand-copied the same chrome read-only and pre-filled). Deliberately thin:
// it owns only the visual chrome (the box, its width, its note line) and
// forwards a ref so the live drill can still focus/read it directly and key
// it per-question — everything about WHAT the input does (live typing, IME
// conversion, submit-on-Enter, the warning-vs-standing-note swap) stays the
// caller's job, same split PitchClipBoard and McOptionGrid make from their
// own callers.

import { forwardRef } from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface TypedAnswerBoxProps {
  value: string;
  /** Omit for a read-only box (the gallery's reference cards never edit). */
  onChange?: (value: string) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  inputMode?: "numeric";
  placeholder?: string;
  /** The line under the box — the live drill's standing answer-format guide,
   * or (mid-retype) SAK-122's wrong-script warning; the gallery's fixed
   * "the correct answer, for reference" caption. Always rendered, even when
   * empty, so the box's height doesn't shift when the note appears. */
  note?: React.ReactNode;
  noteTone?: "muted" | "warning";
  /** Forces a remount on a new question, exactly like drill-screen's
   * `key={rt.asked}` — so a stale value can never bleed into the next card.
   * The gallery has no such concept and omits it. */
  resetKey?: React.Key;
}

/** The exact typed-answer box the live drill and the dev gallery both render
 * — see the header comment for the split between this component's chrome and
 * the caller's behavior. */
export const TypedAnswerBox = forwardRef<HTMLInputElement, TypedAnswerBoxProps>(
  function TypedAnswerBox(
    { value, onChange, readOnly, autoFocus, inputMode, placeholder, note, noteTone = "muted", resetKey },
    ref,
  ) {
    return (
      <span className="flex flex-col items-center gap-1.5">
        <input
          key={resetKey}
          ref={ref}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className="kq-material w-[270px] rounded-lg border border-border bg-card px-3 py-2 text-center text-lg text-text outline-none focus:border-accent"
        />
        <span
          className={cx(
            "text-[11px]",
            noteTone === "warning" ? "text-warning" : "text-text-muted",
          )}
        >
          {note}
        </span>
      </span>
    );
  },
);
