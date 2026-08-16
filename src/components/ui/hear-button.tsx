"use client";

// THE sound button. One control for "hear this," used everywhere the app plays
// a pronunciation — lessons, quiz, and the Library alike — so a kana heard while
// learning it sounds exactly like the same kana heard later while looking it up.
//
// VOICE IS NEVER PASSED AROUND BY HAND. This button reads the learner's chosen
// voice straight off quiz config (Settings' voice picker), the same source the
// quiz drills use, so a lesson and a Library page cannot drift onto two
// different voices the way separate ad-hoc buttons once did. `voiceName` exists
// only for the rare caller with a genuine reason to pin something else (a
// conversion pair naming its own base/converted glyphs still just wants the
// configured voice, so it doesn't need this either) — omit it and get the
// configured voice.
//
// ONE LOOK, EVERYWHERE. A bare accent-coloured speaker glyph, no pill/border —
// a dense list and an entry page used to render two different chips for the
// same action, and a learner shouldn't have to notice a shape change to know
// it's the same button.

import { SoundIcon } from "@/components/ui";
import { prefetchClip, speak } from "@/lib/speech";
import { useQuizConfig } from "@/lib/quiz-config";

export function HearButton({
  glyph,
  voiceName,
  className = "",
  // When the button sits inside a click target of its own (a Library tile is
  // itself a toggle), swallow the click and the pointerenter so aiming at the
  // speaker never also fires the surface behind it.
  stopPropagation = false,
  // Override the announced name when the glyph is not the whole story (a Library
  // entry reads out its full name, not just its lead glyph).
  label,
}: {
  glyph: string;
  /** Pin a specific voice; omit to speak in the learner's configured voice. */
  voiceName?: string;
  className?: string;
  stopPropagation?: boolean;
  label?: string;
}) {
  const { cfg } = useQuizConfig();
  const voice = voiceName ?? cfg.voiceName;
  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        speak(glyph, voice);
        // A mouse click leaves the button focused in some browsers, which pins
        // a `group-focus-within` hover reveal (a Library tile's 🔊/↗ corner)
        // visible after the pointer has moved away. `e.detail` is 0 for a
        // keyboard-triggered click (Enter/Space), so this only blurs the mouse
        // case and a keyboard user keeps their focus ring.
        if (e.detail !== 0) e.currentTarget.blur();
      }}
      // Warm the clip while the pointer is on its way, so the synth is done by
      // the click. Only the button you aim at fetches; hover on touch is a no-op.
      onPointerEnter={(e) => {
        if (stopPropagation) e.stopPropagation();
        prefetchClip(glyph, voice);
      }}
      onFocus={() => prefetchClip(glyph, voice)}
      aria-label={label ?? `Hear ${glyph}`}
      // `self-center` wins the alignment in a flex row (a bare icon has no text
      // baseline to line up on, so `items-baseline` siblings left it floating);
      // `align-middle` does the same job inline. Baked in here so no caller needs
      // its own nudge — the per-caller `align-[-0.15em]` / `mt-0.5` guesses this
      // replaces were never quite right anyway.
      className={`inline-flex flex-none cursor-pointer items-center justify-center self-center align-middle border-none bg-transparent p-0 leading-none text-accent ${className}`}
    >
      <SoundIcon />
    </button>
  );
}
