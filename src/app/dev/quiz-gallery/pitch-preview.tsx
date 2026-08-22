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
//
// Also renders the same Halo glyph stage the live pitch card shows above its
// question (SAK-133: a pitch showing renders its glyph exactly like any
// other jp2en meaning card, never blanked) — `glyph` is passed in rather
// than carried on `PitchShowing` itself, since it's a display-only concern
// this gallery needs and the live drill already derives its own from the
// broader question it's showing, not from the pitch data.

import { useState } from "react";

import { Btn } from "@/components/ui";
import { PitchClipBoard } from "@/components/quiz/pitch-clip-board";
import { pitchInstruction, type PitchShowing } from "@/lib/pitch-quiz";
import { Halo } from "./halo-preview";

function playClip(url: string) {
  const audio = new Audio(url);
  void audio.play().catch(() => {
    // No fallback — see drill-screen.tsx's playPitchClip for why.
  });
}

export function PitchPreview({
  glyph,
  showing,
}: {
  glyph: string;
  showing: PitchShowing;
}) {
  const [pick, setPick] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3">
      <Halo glyph={glyph} jp />
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
        <Btn
          go
          className="w-20"
          disabled={pick === null}
          onClick={() => setRevealed(true)}
          title="Check (Enter)"
        >
          Check
        </Btn>
      )}
    </div>
  );
}
