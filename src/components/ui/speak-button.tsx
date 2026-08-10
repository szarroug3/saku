"use client";

// A small speaker button that voices Japanese text via speech.ts (the app's
// voice discovery + speak). Resolves an auto-picked Japanese voice on mount and
// disables until one is available.

import { useEffect, useState } from "react";

import { SoundIcon } from "@/components/ui";
import { speak, jaVoices, pickAutoVoice, onVoicesChanged } from "@/lib/speech";

export function SpeakButton({ text, label }: { text: string; label?: string }) {
  const [voice, setVoice] = useState<string | null>(null);
  useEffect(() => {
    const resolve = () => {
      const v = pickAutoVoice(jaVoices());
      if (v) setVoice(v.name);
    };
    resolve();
    return onVoicesChanged(resolve);
  }, []);
  return (
    <button
      type="button"
      aria-label={label ?? `Hear ${text}`}
      disabled={!voice}
      onClick={() => voice && speak(text, voice)}
      className="cursor-pointer border-none bg-transparent p-0 align-[-0.15em] text-text-muted disabled:opacity-40"
    >
      <SoundIcon />
    </button>
  );
}
