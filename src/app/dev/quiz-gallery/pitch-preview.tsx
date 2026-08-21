"use client";

// SAK-128's two-clip pick board — same isolation reason as
// particle-tap-preview.tsx: a click handler that plays audio needs a Client
// Component boundary, so it's split out to keep the gallery page itself a
// Server Component. Markup/classes are a deliberate copy of the real board in
// drill-screen.tsx (the correct clip lit green, same option-tile geometry),
// not a shared import — same relationship McGrid/TypedBox already have to
// their drill-screen originals on this page.

import { SoundIcon } from "@/components/ui";
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
      <div className="flex w-[min(92vw,480px)] flex-wrap justify-center gap-3">
        {showing.clips.map((clip, i) => (
          <button
            key={clip}
            onClick={() => playClip(clip)}
            aria-label={`Play clip ${i + 1}`}
            className={`flex min-h-20 shrink-0 grow-0 basis-[calc((100%-12px)/2)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-3 py-3 text-center ${
              i === showing.correct
                ? "border-success bg-success-bg text-success"
                : "border-border bg-card text-text hover:bg-panel"
            }`}
          >
            <SoundIcon className="size-8" />
            <span className="text-[10px] text-text-muted">{i + 1}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-text-muted">tap either clip to hear it</p>
    </div>
  );
}
