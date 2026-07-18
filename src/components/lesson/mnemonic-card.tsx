// The mnemonic, on screen — the one place src/data/mnemonics.ts becomes pixels.
//
// SELF-CONTAINED, ON PURPOSE
// ==========================
// This renders one entry and nothing else: no state, no hooks, no speech, no
// data lookup of its own beyond the `getMnemonic` gate its callers apply. Two
// call sites use it as-is — the teach-me walkthrough (components/lesson/
// teach-me.tsx) and the Library entry page (app/library/[entry]/page.tsx) — and
// a third (the future stepped teach screen) will re-consume it. Keeping it
// dependency-light is what lets it move between them without a rewrite.
//
// HIDE WHEN ABSENT
// ================
// The card never renders an empty state. A glyph with no mnemonic shows no
// section at all, and that decision lives with the CALLER: each gates on
// `getMnemonic(glyph)` and renders <MnemonicCard> only when it returns
// non-null. This component takes a resolved `Mnemonic`, so "there is nothing to
// show" is simply "the caller didn't mount me."
//
// THE PICTURE SITS DIRECTLY ON THE CARD
// =====================================
// The slot on the left shows the entry's drawn picture when one exists at
// /mnemonics/<romaji>.webp, and falls back to the plain glyph as a placeholder
// when it doesn't. `getMnemonic` always hands over a candidate `image` path; the
// `MnemonicImage` wrapper loads it and swaps to the glyph on error (a missing
// file 404s), so which kana show a drawing is decided by what's on disk, not by
// this component. This card already sits inside the entry page's own card, so the
// image needs no frame of its own: it renders DIRECTLY on the card material with
// no nested box/tile behind it. A transparent-PNG image shows the card's material
// THROUGH its empty areas. The glyph placeholder likewise renders plain, no box.
//
// THE ACCENT IS THE SOUND
// =======================
// A `SoundLine` is an ordered array of spans; a span with `accent: true` is one
// the kana's sound is actually spoken in, and it — and only it — takes the
// accent colour. A shape word is never accented (see the rule in
// src/data/mnemonics.ts). `Line` below maps the spans, painting accent spans and
// leaving the rest plain. A span may also carry an `href`, which makes that run
// a link — the escape hatch for sounds English can't approximate (ら), where the
// honest hook is a pointer to a real explanation rather than a fake analogy.
//
// THE NARRATIVE LEADS, THE ANALOGY FOLLOWS
// ========================================
// The mnemonic (the one-scene story) is the memory hook, so it is the prominent
// line — full text colour, comfortable size. The analogy (the "say it like…"
// cue) is the secondary line — muted and a touch smaller. The accent colour
// still marks the sound in both.

import { SoundIcon } from "@/components/ui";
import type { Mnemonic, SoundLine } from "@/data/mnemonics";

import { MnemonicImage } from "./mnemonic-image";

/** Render a SoundLine's spans, painting `accent: true` spans in the accent
 * colour and leaving the rest plain. A span carrying an `href` renders as an
 * anchor into a new tab — and a span that is BOTH accented and linked keeps the
 * accent colour. Exported so the stepped lesson's own hero
 * (lesson-item-view.tsx) renders the same accented prose from the same data
 * without re-implementing the span rule. */
export function Line({ line }: { line: SoundLine }) {
  return (
    <>
      {line.map((span, i) => {
        const accent = span.accent ? "font-semibold text-accent" : undefined;
        return span.href ? (
          <a
            key={i}
            href={span.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline underline-offset-2 hover:opacity-80 ${accent ?? "font-medium text-accent"}`}
          >
            {span.text}
          </a>
        ) : (
          <span key={i} className={accent}>
            {span.text}
          </span>
        );
      })}
    </>
  );
}

export function MnemonicCard({ m }: { m: Mnemonic }) {
  const chars = [...m.example.word];

  return (
    <div className="mt-3">
      <div className="flex items-start gap-4">
        {/* The picture, or the glyph. This card already sits inside the entry
            page's own card, so the image needs no frame of its own — it renders
            DIRECTLY on the card with no nested box/tile behind it. A
            transparent-PNG image shows the card's material through its empty
            areas. When no webp exists for this kana, MnemonicImage falls the
            candidate path back to the plain glyph placeholder, likewise no box. */}
        <MnemonicImage
          src={m.image!}
          glyph={m.glyph}
          imgClassName="size-[84px] flex-none object-contain"
          glyphClassName="flex size-[92px] flex-none items-center justify-center font-kana text-[52px] leading-none"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-kana text-[26px] leading-none">{m.glyph}</span>
            <span className="text-[13px] text-text-muted">{m.romaji}</span>
            {m.object ? (
              <span className="ml-auto rounded-full bg-accent-bg px-2 py-0.5 text-[11px] font-medium text-accent">
                {m.object}
              </span>
            ) : null}
          </div>

          {/* The narrative is the memory hook, so it leads — prominent, full
              text colour. The analogy is the muted, smaller secondary line. */}
          <p className="mt-2 text-[14px] leading-relaxed">
            <Line line={m.mnemonic} />
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
            <Line line={m.analogy} />
          </p>
          {m.approximate ? (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-warning">
              <SoundIcon className="mr-1 align-[-0.15em]" />
              {m.approximate}
            </p>
          ) : null}
        </div>
      </div>

      {/* The kana caught in a real word, its own glyph accented. */}
      <div className="mt-3 flex items-baseline gap-2 border-t border-border pt-2.5 text-[13px]">
        <span className="font-kana text-[20px]">
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
  );
}
