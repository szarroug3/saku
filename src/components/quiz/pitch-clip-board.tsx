"use client";

// SAK-131: the two-clip pitch-accent board (SAK-128/SAK-133), shared between
// the live drill (drill-screen.tsx) and the /dev/quiz-gallery static preview
// (pitch-preview.tsx) — previously the gallery hand-copied this markup, which
// let the two silently drift (see SAK-131). Purely presentational: it renders
// the two clip tiles and reports taps via `onTap`; it never plays audio and
// never grades an answer itself — both of those stay the caller's job (the
// live screen also has to select-then-Check, per SAK-133; the gallery just
// plays the clip and leaves `revealing` permanently on).

import { SoundIcon } from "@/components/ui";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface PitchClipBoardProps {
  /** The two clip URLs, in the order the board shows them. */
  clips: readonly string[];
  /** Index of the correct clip — only used to color a tile once `revealing`. */
  correct: number;
  /**
   * Whether to show the graded reveal colors (correct clip green, a wrong
   * pick red). The live drill flips this on only after Check/Enter resolves
   * the showing; the gallery's static preview passes it permanently true,
   * the same "always-revealed reference" convention `McOptionGrid` uses.
   */
  revealing: boolean;
  /** The clip index the learner has selected but not yet submitted — lit with
   * an accent outline while `!revealing`. null when nothing is picked yet, or
   * whenever the caller has no such concept (the gallery passes null). */
  pick: number | null;
  /** The clip index that was picked and graded WRONG, kept lit red alongside
   * the correct clip's green once `revealing` (SAK-50's wrong-pick-stays-lit
   * convention — see DrillQuestion.pitchWrongPick). null when there was no
   * wrong pick, or when the caller has no such concept. */
  wrongPick?: number | null;
  /** Called when a clip tile is tapped, with its index. The live drill both
   * plays the clip and records the pick; the gallery only plays it. Omit for
   * a fully inert board (there is no such caller today, but nothing requires
   * one). */
  onTap?: (index: number) => void;
}

/** The exact two-clip tile board the live pitch-accent question renders,
 * minus the audio playback and the Check button — both stay with the caller
 * (see the header comment). */
export function PitchClipBoard({
  clips,
  correct,
  revealing,
  pick,
  wrongPick = null,
  onTap,
}: PitchClipBoardProps) {
  return (
    <div className="flex w-[min(92vw,480px)] flex-wrap justify-center gap-3">
      {clips.map((clip, i) => (
        <button
          key={clip}
          type="button"
          onClick={onTap ? () => onTap(i) : undefined}
          aria-label={`Play clip ${i + 1}`}
          aria-pressed={pick === i}
          className={cx(
            "flex min-h-20 shrink-0 grow-0 basis-[calc((100%-12px)/2)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-3 py-3 text-center",
            revealing && i === correct
              ? "border-success bg-success-bg text-success"
              : revealing && i === wrongPick
                ? "border-danger bg-danger-bg text-danger"
                : !revealing && pick === i
                  ? "border-accent bg-panel text-text"
                  : "border-border bg-card text-text hover:bg-panel",
          )}
        >
          <SoundIcon className="size-8" />
          <span className="text-[10px] text-text-muted">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}
