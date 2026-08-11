"use client";

// THE sound button. One control for "hear this", so every speaker across the
// Library reference pages looks and behaves the same: a bare accent speaker icon,
// no box. Pass the text to voice; an optional voiceName pins a specific voice
// (otherwise the app's auto-picked Japanese voice is resolved on mount, the same
// way SpeakButton did). Replaces the ad-hoc `<button><SoundIcon/></button>` copies
// that had drifted apart across the entry views.

import { useEffect, useState } from "react";

import { SoundIcon } from "@/components/ui";
import { jaVoices, onVoicesChanged, pickAutoVoice, speak } from "@/lib/speech";

export function SoundButton({
  text,
  voiceName,
  label,
  className = "",
}: {
  text: string;
  /** Pin a voice; omit to use the auto-picked Japanese voice. */
  voiceName?: string;
  /** Override the announced label (defaults to `Hear {text}`). */
  label?: string;
  className?: string;
}) {
  const [auto, setAuto] = useState<string | null>(null);
  useEffect(() => {
    if (voiceName) return;
    const resolve = () => {
      const v = pickAutoVoice(jaVoices());
      if (v) setAuto(v.name);
    };
    resolve();
    return onVoicesChanged(resolve);
  }, [voiceName]);

  return (
    <button
      type="button"
      onClick={() => speak(text, voiceName ?? auto ?? "")}
      aria-label={label ?? `Hear ${text}`}
      className={`inline-flex flex-none cursor-pointer items-center border-none bg-transparent p-0 leading-none text-accent ${className}`}
    >
      <SoundIcon />
    </button>
  );
}
