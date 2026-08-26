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
//
// EXACT PITCH MODE (SAK-100, folded in from the retired PitchHearButton). Pass
// `downstep` when the caller already knows a word's VERIFIED pitch-accent
// pattern (the Library word page, off wordPitch/legacyUnqualifiedReading in
// character-entry-view.tsx) and wants it applied with no fuzzy matching — see
// synthesizeWordWav's doc comment in src/lib/tts-synth.ts. Without it, the
// button still carries pitch correction: /api/tts matches each spoken
// sentence's own accent phrases against the pitch dataset on the fly (see
// src/lib/sentence-pitch.ts) — `downstep` just skips that guesswork when the
// exact answer is already in hand. In this mode the button plays straight from
// /api/pitch-tts rather than through lib/speech.ts's Auto/roster tiering: this
// clip has exactly one source, so on failure there is no OTHER fallback —
// substituting a different voice would lose the very thing the mode exists to
// demonstrate.
//
// SAK-208: one retry, same source. A pitch-quiz "wrong" card's distractor
// clip (src/lib/pitch-quiz.ts) is a SYNTHETIC mispitch — a (reading,
// downstep) pair invented for the quiz, never a word's real verified accent
// — so it can never appear in the seed script's pre-seeded set (that only
// ever seeds real accents, see scripts/seed-voice-audio.mjs's pitchItems()).
// Its first-ever play by anyone, anywhere, always hits /api/pitch-tts's
// live-synthesis fallback cold, which can be slow enough (a Cloud Run
// container spinning up) to fail outright rather than just feel slow — and
// this button had no retry at all, so that read as "the clip is missing"
// rather than "the first request was slow." A second attempt, right after
// the first's rejection, almost always lands warm.

import { SoundIcon } from "@/components/ui";
import { prefetchClip, speak } from "@/lib/speech";
import { useQuizConfig } from "@/lib/quiz-config";
import { DEFAULT_VOICE_ID, pitchApiUrl } from "@/lib/voice";

export function HearButton({
  glyph,
  voiceName,
  downstep,
  className = "",
  // When the button sits inside a click target of its own (a Library tile is
  // itself a toggle), swallow the click and the pointerenter so aiming at the
  // speaker never also fires the surface behind it.
  stopPropagation = false,
  // Override the announced name when the glyph is not the whole story (a Library
  // entry reads out its full name, not just its lead glyph).
  label,
}: {
  /** The reading (kana) or text to speak. In EXACT PITCH mode (`downstep`
   * set) this must be the word's kana reading — VOICEVOX is asked to read it
   * directly, not to infer it from kanji. */
  glyph: string;
  /** Pin a specific voice; omit to speak in the learner's configured voice. */
  voiceName?: string;
  /** EXACT PITCH mode — the mora position of the word's verified downstep
   * (see src/lib/pitch.ts). Omit for ordinary speech (still pitch-corrected,
   * just via the fuzzy sentence-level match instead of a known-exact one). */
  downstep?: number;
  className?: string;
  stopPropagation?: boolean;
  label?: string;
}) {
  const { cfg } = useQuizConfig();
  const voice = voiceName ?? cfg.voiceName;

  if (downstep !== undefined) {
    const voiceId = voice || DEFAULT_VOICE_ID;
    return (
      <button
        type="button"
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          const url = pitchApiUrl(glyph, downstep, voiceId);
          const attempt = () => new Audio(url).play();
          // SAK-208: one retry, same URL, right after the first rejection —
          // see the module header on why this is the one fallback that
          // doesn't compromise "exactly one source." No fallback beyond
          // that on purpose.
          void attempt().catch(() => attempt().catch(() => {}));
          if (e.detail !== 0) e.currentTarget.blur();
        }}
        onPointerEnter={(e) => {
          if (stopPropagation) e.stopPropagation();
          void fetch(pitchApiUrl(glyph, downstep, voiceId)).catch(() => {});
        }}
        aria-label={label ?? `Hear ${glyph} with its pitch accent`}
        className={`inline-flex flex-none cursor-pointer items-center justify-center self-center align-middle border-none bg-transparent p-0 leading-none text-accent ${className}`}
      >
        <SoundIcon />
      </button>
    );
  }

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
