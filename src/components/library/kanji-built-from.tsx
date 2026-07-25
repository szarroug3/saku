"use client";

// "Built from" — a kanji taken apart into the SHAPES it is built from.
//
// The kanji page's counterpart to the word page's WordBuiltFrom, and the
// deliberate division of labour between the two: the WORD page owns the READING
// decomposition (電話 → 電 でん + 話 わ), the KANJI page owns the SHAPE
// decomposition (可 → 丁 street + 口 mouth). A single-kanji word's reading split
// is just the word repeating itself, so the word page hides it there and points
// here; this is where the one useful breakdown of a lone kanji lives.
//
// SAME SOURCE AS THE LESSON, SAME CARD AS THE WORD PAGE. The pieces come from
// teachableParts — the de-framed, all-or-nothing decomposition the lesson's
// KanjiPartsRow and the drill's hint both read, so a kanji looked up here is
// broken apart exactly as it was taught. The tiles are WordBuiltFrom's KanjiPiece
// tile — glyph over meaning, linked to the piece's own page — so the two "Built
// from" cards read as one idea in two directions rather than two designs.
//
// ALL-OR-NOTHING, and that is teachableParts' call, not this component's. A kanji
// whose pieces are not every one a taught kanji (a raw primitive like ｜ ノ マ, or
// an atomic shape) yields null, and this renders nothing at all — no empty card,
// no "made of nothing" line. The frame double-count teachableParts now collapses
// (可 was 丁 + 口 + 丁) never reaches here.

import Link from "next/link";

import { Card, Lbl } from "@/components/ui";
import { kanjiEntry } from "@/data/kanji";
import { teachableParts } from "@/lib/kanji-parts";
import { entryHref } from "@/lib/library/href";

export function KanjiBuiltFrom({ glyph }: { glyph: string }) {
  const parts = teachableParts(glyph);
  if (!parts) return null;

  return (
    <Card>
      <Lbl>Built from</Lbl>
      <div className="flex flex-wrap items-stretch gap-2">
        {parts.map((p, i) => (
          <Link
            key={`${p.c}-${i}`}
            href={entryHref(kanjiEntry(p.c))}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-text no-underline hover:bg-panel"
          >
            <span className="text-[30px] leading-none">{p.c}</span>
            {p.meaning ? (
              <span className="text-[12px] text-text-muted">{p.meaning}</span>
            ) : null}
          </Link>
        ))}
      </div>
      <p className="mt-2.5 text-xs text-text-muted">
        Each piece is a character you learn on its own.
      </p>
    </Card>
  );
}
