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
import type { ReactNode } from "react";

import { Callout } from "@/components/lesson/callout";
import { Line } from "@/components/lesson/mnemonic-card";
import { MnemonicImage } from "@/components/lesson/mnemonic-image";
import { HearButton } from "@/components/ui/hear-button";
import type { Mnemonic } from "@/data/mnemonics";

export function MnemonicView({
  m,
  glyph,
  href,
  soundNote,
}: {
  /** The authored hook — the single source both views render. */
  m: Mnemonic;
  /** The character to SPEAK. The entry's own glyph, which is `m.glyph` for
   * every authored kana; passed explicitly so the caller stays the authority on
   * what its page is about. */
  glyph: string;
  /** Where the picture and the glyph link to. The lesson passes the Library
   * entry, so the walk-through can open the reference; the entry page passes
   * nothing, because it IS the reference and a link to itself is noise. */
  href?: string;
  /** The irregular-sound call-out ("Said 'chi', not 'ti'"), when this kana has
   * one. Rendered right under the sound line, since it is a correction to how
   * the character is pronounced. Both call sites derive it from the glyph. */
  soundNote?: ReactNode;
}) {
  const chars = [...m.example.word];

  // The glyph stand-in, sized as a headword: big enough to be the subject of the
  // row, nowhere near the 440px the drawing gets — an undrawn kana should not
  // leave a hole the size of a picture.
  // The drawing. Every kana has one (Mnemonic.image is required); MnemonicImage
  // still keeps its own glyph fallback should a file 404. NO tile: the art sits
  // on the bare surface. Every drawing gets the same responsive square viewport —
  // object-contain preserves each without its aspect ratio changing the row height.
  const picture = (
    <MnemonicImage
      src={m.image}
      glyph={m.glyph}
      imgClassName="aspect-square w-full max-w-[440px] object-contain"
      glyphClassName="flex size-[220px] max-w-full items-center justify-center font-kana text-[150px] font-extralight leading-none text-text"
      priority
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
        {/* The narrative is the memory hook, so it leads — prominent, full text
            colour. The glyph, reading and object pill are the entry HEADER's job
            (ContentEntryHeader), so this block is the hook alone. The analogy is
            the muted secondary line, with the speaker immediately to its left. */}
        <p className="text-[16px] leading-relaxed">
          <Line line={m.mnemonic} />
        </p>
        <p className="mt-2.5 flex items-baseline gap-2 text-[15px] leading-relaxed text-text-muted">
          <HearButton glyph={glyph} />
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
            make this sound exactly. A heads-up aside (same left-rule treatment
            other pages use), not a coloured sound line: it is about how to say
            the kana, so it needs no speaker of its own. */}
        {m.approximate ? (
          <div className="mt-3">
            <Callout>{m.approximate}</Callout>
          </div>
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
