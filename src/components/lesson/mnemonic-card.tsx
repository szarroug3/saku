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
// THE PICTURE IS A CONSTANT
// =========================
// The slot on the left shows the entry's drawn `image` when it has one, and
// falls back to the plain glyph as a placeholder when it doesn't. The image
// sits on a FIXED light tile — a constant background set in an inline style, not
// a theme token — so the picture reads the same across all four themes and in
// both light and dark, whatever its own background or transparency is (a/i are
// RGBA, u is RGB). Only the surrounding chrome (the border) follows the theme.
// The glyph placeholder, having no fixed picture to protect, uses the themed
// panel like any other surface.
//
// THE ACCENT IS THE SOUND
// =======================
// `SoundLine` carries one optional emphasis, `sound`, and it is the substring
// this accents. A shape word is never accented — see the rule in
// src/data/mnemonics.ts. `Line` below renders exactly that span in the accent
// colour and nothing else; a `null` sound accents nothing.

import type { Mnemonic, SoundLine } from "@/data/mnemonics";

/** Render a SoundLine, accenting only its `sound` span (or nothing). Exported so
 * the stepped lesson's own hero (lesson-item-view.tsx) renders the same accented
 * prose from the same data without re-implementing the one-span rule. */
export function Line({ line }: { line: SoundLine }) {
  if (line.sound === null) {
    return (
      <>
        {line.lead}
        {line.tail}
      </>
    );
  }
  return (
    <>
      {line.lead}
      <span className="font-medium text-accent">{line.sound}</span>
      {line.tail}
    </>
  );
}

export function MnemonicCard({ m }: { m: Mnemonic }) {
  const chars = [...m.example.word];

  return (
    <div className="kq-material mt-3 rounded-lg border border-border bg-card px-3.5 py-4">
      <div className="flex items-start gap-4">
        {/* The picture, or the glyph. When the entry has a drawn image, it sits
            on a FIXED light tile — the backgroundColor is a constant, not a
            theme token — so the picture holds its look across every theme
            regardless of its own transparency; only the border follows the
            theme. With no image, the slot shows the plain glyph on the themed
            panel as a placeholder. */}
        {m.image ? (
          <div
            className="flex size-[92px] flex-none items-center justify-center overflow-hidden rounded-md border border-border"
            style={{ backgroundColor: "#f7f3ec" }}
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.image} alt="" className="size-[84px] object-contain" />
          </div>
        ) : (
          <div
            className="flex size-[92px] flex-none items-center justify-center rounded-md border border-border bg-panel text-text"
            aria-hidden
          >
            <span className="font-kana text-[52px] leading-none">{m.glyph}</span>
          </div>
        )}

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

          <p className="mt-2 text-[13px] leading-relaxed">
            <Line line={m.analogy} />
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
            <Line line={m.mnemonic} />
          </p>
          {m.approximate ? (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-warning">
              <span aria-hidden>🔊 </span>
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
