"use client";

// SAK-128's two-clip pick board — same isolation reason as
// particle-tap-preview.tsx: a click handler that plays audio needs a Client
// Component boundary, so it's split out to keep the gallery page itself a
// Server Component. Renders the exact shared board drill-screen.tsx renders
// (SAK-131: PitchClipBoard) with `revealing` permanently on — the correct
// clip lit green, same option-tile geometry — rather than a hand-copied
// second implementation that could silently drift from the live one.

import { PitchClipBoard } from "@/components/quiz/pitch-clip-board";
import type { PitchShowing } from "@/lib/pitch-quiz";

function playClip(url: string) {
  const audio = new Audio(url);
  void audio.play().catch(() => {
    // No fallback — see drill-screen.tsx's playPitchClip for why.
  });
}

export function PitchPreview({ showing }: { showing: PitchShowing }) {
  const instruction =
    showing.mode === "pair"
      ? `Which one means "${showing.promptGloss}"?`
      : "Which one sounds right?";
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[15px] text-text">{instruction}</p>
      <PitchClipBoard
        clips={showing.clips}
        correct={showing.correct}
        revealing
        pick={null}
        onTap={(i) => playClip(showing.clips[i])}
      />
      <p className="text-[11px] text-text-muted">tap either clip to hear it</p>
    </div>
  );
}
