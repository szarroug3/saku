"use client";

// The picker's footer: what you have selected, and the one button that acts
// on it.
//
// WHY IT EXISTS. Every card on Home is one click from a quiz — that is the
// whole point of the shelves. The custom selection was the only WHAT on the
// page you could not start: you built it here and then had to scroll back up
// past 54 rows to the hero to run it. One gesture, same as a deck card.
//
// It states the count against the whole 214 and NEVER against the search
// scope, because that count is literally the deck the button will run. The
// rows above are scoped by the search box; this line is the thing that isn't.
//
// `sticky bottom-0` rather than `fixed`: this belongs to the picker, not to
// the page, so it rides the picker's bottom edge, follows you while the picker
// is on screen, and leaves with it. It also inherits kiri's
// `[class~="sticky"][class~="bg-bg"]` frost by construction — a sticky opaque
// band would otherwise punch a rectangle straight through that theme's mesh —
// and momentum's `[class~="rounded-lg"][class~="bg-text"]` primary-button
// shelf. Both are the intended reads, not accidents; keep the class tokens.

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Mirrors Home's own prompt: starting from here throws away a running quiz
 * exactly the way a deck card does, so it has to ask the same question. Home
 * keeps its copy private, so this is a deliberate duplicate. */
const DISCARD_PROMPT = "Discard the quiz in progress and start a new one?";

export function PickerBar({
  count,
  total,
  /** A quiz is in progress — starting this one discards it. */
  active,
  /** The hero's setup can't run any quiz (no direction chosen). */
  howBroken,
  onStart,
}: {
  count: number;
  total: number;
  active: boolean;
  howBroken: boolean;
  onStart: () => void;
}) {
  const disabled = !count || howBroken;
  // Never a bare greyed-out button: say which of the two reasons it is.
  const reason = !count
    ? "Pick at least one character."
    : howBroken
      ? "The setup above has no direction — nothing can start."
      : null;

  return (
    <div
      className={cx(
        "sticky bottom-0 -mx-[18px] -mb-[18px] flex flex-wrap items-center gap-x-3 gap-y-1",
        "rounded-b-xl border-t border-border bg-bg px-[18px] py-2.5",
      )}
    >
      <span className="text-xs text-text-muted">
        <b className="tabular-nums text-text">{count}</b>
        <span className="tabular-nums"> of {total}</span> characters selected
        {reason ? <span className="text-text-muted"> · {reason}</span> : null}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (active && !window.confirm(DISCARD_PROMPT)) return;
          onStart();
        }}
        className={cx(
          "ml-auto flex-none cursor-pointer rounded-lg bg-text px-3.5 py-1.5",
          "text-[13px] font-semibold text-bg",
          "disabled:cursor-default disabled:opacity-40",
        )}
      >
        {/* Deliberately not full-width like the hero's PrimaryBtn: the hero is
            the main event and this is an escape hatch. Same treatment, a
            quarter of the weight. */}
        {active ? "Discard & start" : "Start drilling"}
      </button>
    </div>
  );
}
