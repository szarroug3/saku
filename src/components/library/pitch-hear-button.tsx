"use client";

// The "Hear it" button beside a word's pitch-accent pattern (SAK-98) — plays
// REAL pitch-varied audio from /api/pitch-tts (VOICEVOX), a different source
// from the app's ordinary HearButton next to it. That button plays the
// learner's configured pack voice, which does NOT carry the word's real
// pitch — the phase-intros "intro-pitch" card tells a learner to trust the
// overline over the sound for exactly that reason. This button is the one
// place in the app where the sound is expected to match the line.
//
// Deliberately its own tiny player rather than routed through lib/speech.ts's
// pack-voice pipeline: that pipeline picks among configured voices and falls
// back across tiers meant for a DIFFERENT kind of clip (the browser voice).
// This clip has exactly one source, so on failure it just stays silent —
// substituting a different voice here would lose the very thing the button
// exists to demonstrate.

import { SoundIcon } from "@/components/ui";
import { pitchApiUrl } from "@/lib/pitch-audio";

export function PitchHearButton({
  reading,
  downstep,
  className = "",
}: {
  reading: string;
  /** The mora position of the downstep — see src/lib/pitch.ts. */
  downstep: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Hear ${reading} with its pitch accent`}
      onClick={() => {
        const audio = new Audio(pitchApiUrl(reading, downstep));
        void audio.play().catch(() => {
          // No fallback on purpose — see the module header.
        });
      }}
      className={`inline-flex flex-none cursor-pointer items-center justify-center self-center align-middle border-none bg-transparent p-0 leading-none text-accent ${className}`}
    >
      <SoundIcon />
    </button>
  );
}
