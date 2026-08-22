"use client";

// SAK-131: the option board every multiple-choice-shaped quiz card renders —
// an MC card, a sentence-recognition card, and the particle marker-choice
// card all draw the same wrapping, up-to-3-per-row tile row (see SAK-54's
// comment history for why this is a flex-wrap row and not a CSS grid: a grid
// with fixed column tracks always reserves all three, so a 2-option board
// reads as pinned left instead of centered). Previously drill-screen.tsx
// implemented that row three separate times (once per board), and
// /dev/quiz-gallery/page.tsx hand-copied a FOURTH, older version of it (a
// fixed `grid-cols-3` that never got the SAK-54 fix) — this component is the
// one shared implementation both now import.
//
// Purely presentational: it takes the options pre-built (label, correctness,
// wrongness already resolved by the caller) and reports a tap via `onSelect`.
// It never decides what "correct" means for a board — that stays with each
// caller's own grading, since an MC option, a recognition option and a
// particle-marker option are graded three different ways upstream.

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface McOptionGridItem {
  /** Unique across this board's options — becomes the React key. */
  readonly key: string;
  readonly label: React.ReactNode;
  /** Lit green once `revealing`. */
  readonly correct: boolean;
  /** Lit red once `revealing`, alongside the correct option's green (SAK-50's
   * wrong-pick-stays-lit convention). Never true at the same time as
   * `correct`. */
  readonly wrong?: boolean;
  /** en2jp MC options roll a per-option JP font at ask time; every other
   * board (recognition, particle-marker, the gallery's reference cards)
   * leaves this unset and renders in the page's default font. */
  readonly fontFamily?: string;
}

export interface McOptionGridProps {
  readonly options: readonly McOptionGridItem[];
  /**
   * Whether to show the graded reveal colors at all. REQUIRED, no default —
   * see PitchClipBoard's identical choice. A shared component whose default
   * happened to match the gallery's "always revealed" static-preview need
   * would make the LIVE quiz's real behavior (never reveal until answered)
   * the exception a caller has to remember to opt into, backwards from what
   * matters: the live drill is the real app, the gallery is the preview of
   * it. Every caller, live or gallery, states its own intent explicitly.
   */
  revealing: boolean;
  /** Recognition options are full sentences and need to wrap and shrink
   * (`text-sm hyphens-auto`); every other board's options are a single short
   * token or glyph and want the larger `text-xl`. */
  size?: "lg" | "sm";
  /** Called with the tapped option's `key` and index. Omit for a fully inert
   * board — the gallery's reference cards never select anything, so they
   * leave this unset. */
  onSelect?: (key: string, index: number) => void;
}

/** The exact option-tile row every MC-shaped quiz board renders. */
export function McOptionGrid({
  options,
  revealing,
  size = "lg",
  onSelect,
}: McOptionGridProps) {
  return (
    <div className="flex w-[min(92vw,480px)] flex-wrap justify-center gap-2">
      {options.map((o, i) => (
        <button
          key={o.key}
          type="button"
          onClick={onSelect ? () => onSelect(o.key, i) : undefined}
          style={o.fontFamily ? { fontFamily: o.fontFamily } : undefined}
          className={cx(
            "flex min-h-[60px] shrink-0 grow-0 basis-[calc((100%-16px)/3)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-center wrap-break-word",
            size === "sm" ? "text-sm hyphens-auto" : "text-xl",
            revealing && o.correct
              ? "border-success bg-success-bg text-success"
              : revealing && o.wrong
                ? "border-danger bg-danger-bg text-danger"
                : "border-border bg-card text-text hover:bg-panel",
          )}
        >
          <span>{o.label}</span>
          <span className="text-[10px] text-text-muted">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}
