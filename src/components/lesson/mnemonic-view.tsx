"use client";

// THE mnemonic block. One implementation, two call sites.
//
// WHY THIS FILE EXISTS
// ====================
// The same authored hook for a kana — the drawing, the reading, the story, the
// sound analogy, the real word — used to be rendered TWICE, by two components
// that had drifted apart: `KanaHero` in the stepped lesson and
// `MergedMnemonicCard` on the Library entry page. Same data, different sizes,
// different arrangement, so a learner who met あ in a lesson had to re-read it
// in the Library. There is now one component and both call it, so what you
// learn in the walk-through is the same thing you look up later.
//
// THE ARRANGEMENT (the lesson's, which won)
// =========================================
// Picture LEFT, words RIGHT, side by side; stacked only when the viewport is too
// narrow to hold both. The picture is capped at the lesson's 440px — the entry
// page used to draw it larger, and two sizes of the same drawing is exactly the
// drift this file removes.
//
// NO TILE BEHIND THE DRAWING
// ==========================
// The art sits DIRECTLY on whatever surface hosts it — the lesson page, the
// entry card. It used to wear a frosted `kq-material` panel with a border; that
// white box read as a frame around a picture that is already a complete object,
// so it is gone from both views. Transparent-PNG drawings now show the real
// background through their empty areas.
//
// THE SPEAKER SITS WITH THE SENTENCE IT SPEAKS
// ============================================
// The sound button is immediately LEFT of the muted "say it like…" line, because
// that line is the one telling you what it sounds like. The lesson used to float
// it in the top-right corner, far from the thing it belonged to.
//
// A KANA WITH NO DRAWING YET
// ==========================
// `getMnemonic` hands every kana a candidate image path whether or not the webp
// has been drawn. `MnemonicImage` swaps to the plain glyph when it 404s; the
// fallback is sized as a headword (220px), not as a 440px hole, and this view
// drops the small header glyph in that case so the character never prints twice.

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Callout } from "@/components/lesson/callout";
import { Line } from "@/components/lesson/mnemonic-card";
import { MnemonicImage } from "@/components/lesson/mnemonic-image";
import { SoundIcon } from "@/components/ui";
import type { Mnemonic } from "@/data/mnemonics";
import { speak } from "@/lib/speech";

export function MnemonicView({
  m,
  glyph,
  voiceName,
  href,
  descriptor,
  soundNote,
}: {
  /** The authored hook — the single source both views render. */
  m: Mnemonic;
  /** The character to SPEAK. The entry's own glyph, which is `m.glyph` for
   * every authored kana; passed explicitly so the caller stays the authority on
   * what its page is about. */
  glyph: string;
  /** Which voice to speak it in (quiz config). */
  voiceName: string;
  /** Where the picture and the glyph link to. The lesson passes the Library
   * entry, so the walk-through can open the reference; the entry page passes
   * nothing, because it IS the reference and a link to itself is noise. */
  href?: string;
  /** Optional muted classification line ("Hiragana · Vowels") — the entry page's
   * row descriptor. The lesson has no such label and passes nothing. */
  descriptor?: string;
  /** The irregular-sound call-out ("Said 'chi', not 'ti'"), when this kana has
   * one. Rendered right under the sound line, since it is a correction to how
   * the character is pronounced. Both call sites derive it from the glyph. */
  soundNote?: ReactNode;
}) {
  const chars = [...m.example.word];

  // Whether the drawing is actually there. `MnemonicImage` owns the fallback;
  // it just tells us, so we can drop the small header glyph and let its big
  // fallback glyph be the only printing of the character.
  const [failed, setFailed] = useState(false);
  // No candidate path at all is the same situation as a path that 404s, and is
  // handled the same way rather than as a second code path.
  const missing = m.image == null || failed;

  // The glyph stand-in, sized as a headword: big enough to be the subject of the
  // row, nowhere near the 440px the drawing gets — an undrawn kana should not
  // leave a hole the size of a picture.
  const glyphClassName =
    "flex size-[220px] max-w-full items-center justify-center font-kana text-[150px] font-extralight leading-none text-text";

  const picture =
    m.image == null ? (
      <span className={glyphClassName} aria-hidden>
        {m.glyph}
      </span>
    ) : (
      <MnemonicImage
        src={m.image}
        glyph={m.glyph}
        onMissing={() => setFailed(true)}
        // NO tile: no kq-material, no border, no bg — the art on the bare
        // surface it was asked to sit on.
        // Every drawing gets the same responsive square viewport. Width alone
        // let portrait sources grow much taller than square ones (か was about
        // 440x690 while あ was 440x440); object-contain preserves each drawing
        // without letting its intrinsic aspect ratio change the row height.
        imgClassName="aspect-square w-full max-w-[440px] object-contain"
        glyphClassName={glyphClassName}
      />
    );

  return (
    <div className="grid items-center gap-x-10 gap-y-7 md:grid-cols-[minmax(0,440px)_1fr]">
      <div className="flex justify-center md:justify-start">
        {href ? (
          <Link
            href={href}
            aria-label={`Open ${glyph} in the Library`}
            className="flex w-full max-w-[440px] items-center justify-center no-underline"
          >
            {picture}
          </Link>
        ) : (
          picture
        )}
      </div>

      <div className="min-w-0">
        {/* The glyph leads, the romaji reads it, the object it was drawn as is
            the pill. The glyph is dropped when the picture is missing, because
            the fallback on the left is already that character, large. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          {missing ? null : (
            <span className="font-kana text-[52px] font-light leading-none text-text">
              {m.glyph}
            </span>
          )}
          <span className="text-[19px] text-text-muted">{m.romaji}</span>
          {m.object ? (
            <span className="rounded-full bg-accent-bg px-2.5 py-0.5 text-[12px] font-medium text-accent">
              {m.object}
            </span>
          ) : null}
          {descriptor ? (
            <span className="ml-auto text-[12.5px] text-text-muted">{descriptor}</span>
          ) : null}
        </div>

        {/* The narrative is the memory hook, so it leads — prominent, full text
            colour. The analogy is the muted secondary line, with the speaker
            immediately to its left. */}
        <p className="mt-5 text-[16px] leading-relaxed">
          <Line line={m.mnemonic} />
        </p>
        <p className="mt-2.5 flex items-baseline gap-2 text-[15px] leading-relaxed text-text-muted">
          <button
            type="button"
            onClick={() => speak(glyph, voiceName)}
            aria-label={`Hear ${glyph}`}
            className="flex-none cursor-pointer border-none bg-transparent p-0 text-accent"
          >
            <SoundIcon className="align-[-0.15em]" />
          </button>
          <span>
            <Line line={m.analogy} />
          </span>
        </p>
        {/* The irregular-sound correction, directly under the sound line it
            corrects ("Said 'chi', not 'ti'"). */}
        {soundNote ? (
          <div className="mt-3">
            <Callout>{soundNote}</Callout>
          </div>
        ) : null}
        {/* Where the analogy is only close, say so — an English mouth doesn't
            make this sound exactly. */}
        {m.approximate ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-warning">
            <SoundIcon className="mr-1 align-[-0.15em]" />
            {m.approximate}
          </p>
        ) : null}
        {/* A plain usage note (を is the object particle) — no speaker icon,
            because it is about how the character is used, not its sound. */}
        {m.usage ? (
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{m.usage}</p>
        ) : null}

        {/* The kana caught in a real word, its own glyph accented. */}
        <div className="mt-6 flex items-baseline gap-2.5 border-t border-border pt-4 text-[15px]">
          <span className="font-kana text-[24px]">
            {chars.map((c, i) => (
              <span key={i} className={i === m.example.hitIndex ? "text-accent" : undefined}>
                {c}
              </span>
            ))}
          </span>
          <span className="text-text-muted">
            {m.example.reading} · {m.example.gloss}
          </span>
        </div>
      </div>
    </div>
  );
}
