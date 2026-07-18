"use client";

// The kana mnemonic slot — the SCAFFOLD state, always present.
//
// WHY THIS EXISTS ALONGSIDE MnemonicCard
// ======================================
// MnemonicCard renders a FINISHED mnemonic: a resolved `Mnemonic`, drawing and
// all, and its callers hide it entirely when a kana has no entry. That is the
// finished-state behaviour and it is correct there. This screen is the owner's
// review scaffold, and the owner asked for the opposite while the illustrations
// are being drawn separately: for kana the slot is ALWAYS on, so the page shows
// the whole shape now and tracks which kana still need a hook.
//
// TWO DELIBERATE DEPARTURES, both the owner's call and both temporary:
//   1. The image slot is the plain CHARACTER, not the mnemonic's SVG. The real
//      drawings drop into the data later without touching this file, so nothing
//      here depends on an SVG being present.
//   2. A kana with no `getMnemonic` entry shows "coming soon", not nothing — so
//      the reviewer sees the scaffold and can see at a glance which kana are
//      still unwritten.
//
// MnemonicCard and the mnemonics data module are left exactly as they are; this
// consumes `getMnemonic`, it does not fork it.

import { getMnemonic, type SoundLine } from "@/data/mnemonics";

/** Render a mnemonic line, accenting only its sound-bearing span — the one rule
 * the whole SoundLine shape exists to enforce (see mnemonics.ts). A null sound
 * accents nothing. */
function Line({ line }: { line: SoundLine }) {
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

export function KanaMnemonic({ glyph }: { glyph: string }) {
  const m = getMnemonic(glyph);
  const chars = m ? [...m.example.word] : [];

  return (
    <div className="kq-material mt-3 rounded-lg border border-border bg-card px-3.5 py-4">
      <div className="flex items-start gap-4">
        {/* PLACEHOLDER for the forthcoming illustration: the character itself.
            The real drawing replaces this from the data later, no code change. */}
        <div className="flex size-[92px] flex-none flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-panel">
          <span className="font-kana text-[46px] leading-none text-text">{glyph}</span>
          <span className="text-[8.5px] uppercase tracking-[0.08em] text-text-muted/70">
            drawing soon
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {m ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-kana text-[24px] leading-none">{m.glyph}</span>
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
            </>
          ) : (
            // No hook authored yet — the scaffold says so plainly rather than
            // hiding, so the owner can see which kana still need one.
            <div className="flex h-full flex-col justify-center">
              <p className="text-[13px] font-medium text-text-muted">
                Mnemonic coming soon
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-text-muted/80">
                A memory hook for {glyph} hasn&rsquo;t been written yet. The sound
                and the character above are all you need for now.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* The kana caught in a real word, its own glyph accented — only when the
          hook (and so the example) exists. */}
      {m ? (
        <div className="mt-3 flex items-baseline gap-2 border-t border-border pt-2.5 text-[13px]">
          <span className="font-kana text-[20px]">
            {chars.map((c, i) => (
              <span
                key={i}
                className={i === m.example.hitIndex ? "text-accent" : undefined}
              >
                {c}
              </span>
            ))}
          </span>
          <span className="text-text-muted">
            {m.example.reading} · {m.example.gloss}
          </span>
        </div>
      ) : null}
    </div>
  );
}
