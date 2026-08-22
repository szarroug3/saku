"use client";

// SAK-128's two-clip pick board — same isolation reason as
// particle-tap-preview.tsx: a click handler that plays audio needs a Client
// Component boundary, so it's split out to keep the gallery page itself a
// Server Component. Renders the exact shared board drill-screen.tsx renders
// (SAK-131: PitchClipBoard), driven through the SAME tap-to-pick,
// Check-to-reveal interaction the live drill uses (SAK-133) — not a
// permanently-revealed answer key. A static "always green" card looked
// nothing like what the live quiz actually shows before you answer (neutral
// tiles, no reveal until Check), which was the whole point SAK-131 asked
// this page to stop missing. Reset re-arms the card so a repeat visitor can
// replay the interaction without reloading the page.

import { useState } from "react";

import { Btn } from "@/components/ui";
import { PitchClipBoard } from "@/components/quiz/pitch-clip-board";
import { pitchInstruction, type PitchShowing } from "@/lib/pitch-quiz";

function playClip(url: string) {
  const audio = new Audio(url);
  void audio.play().catch(() => {
    // No fallback — see drill-screen.tsx's playPitchClip for why.
  });
}

export function PitchPreview({ showing }: { showing: PitchShowing }) {
  const [pick, setPick] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[15px] text-text">{pitchInstruction(showing)}</p>
      <PitchClipBoard
        clips={showing.clips}
        correct={showing.correct}
        revealing={revealed}
        pick={pick}
        onTap={(i) => {
          playClip(showing.clips[i]);
          if (!revealed) setPick(i);
        }}
      />
      {revealed ? (
        <button
          type="button"
          className="cursor-pointer text-[11px] text-accent hover:underline"
          onClick={() => {
            setPick(null);
            setRevealed(false);
          }}
        >
          Reset
        </button>
      ) : (
        <>
          <p className="text-[11px] text-text-muted">
            tap either clip to hear it, then Check
          </p>
          <Btn
            go
            className="w-20"
            disabled={pick === null}
            onClick={() => setRevealed(true)}
            title="Check (Enter)"
          >
            Check
          </Btn>
        </>
      )}
    </div>
  );
}
