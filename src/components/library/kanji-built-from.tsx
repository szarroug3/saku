"use client";

// "Built from" — a kanji taken apart into the SHAPES it is built from.
//
// The kanji page's counterpart to the word page's WordBuiltFrom, and the
// deliberate division of labour between the two: the WORD page owns the READING
// decomposition (電話 → 電 でん + 話 わ), the KANJI page owns the SHAPE
// decomposition (可 → 丁 street + 口 mouth).
//
// THE FULL DECOMPOSITION, RADICALS INCLUDED. This is fed by `builtFrom`, not the
// lesson's kanji-only `teachableParts`: 何 is 亻 person + 可 possible, and the 亻
// half is exactly the part a learner needs even though it is a bound form with no
// kanji card of its own. Each tile links — a variant like 亻 through to the
// character it stands for (人), a bare primitive to its /radical page — so the
// section is also the page's outgoing "made of" links, which is why the compact
// Links-card row it used to duplicate is gone.
//
// SAME CARD AS THE WORD PAGE, SAME FRAME-DEDUP AS THE LESSON. The tile is
// WordBuiltFrom's KanjiPiece tile — glyph over meaning, linked. The pieces come
// through `deframe`, so a single enclosure KanjiVG split in two (可 was 丁 口 丁)
// shows once, while a genuine repetition (品 口口口) is left whole.
//
// Empty for an atomic kanji (一, no pieces) — `builtFrom` returns [], and this
// renders nothing at all: no empty card.

import Link from "next/link";

import { Card, Lbl } from "@/components/ui";
import { builtFrom } from "@/lib/library/entries";
import type { LibEntry } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";

export function KanjiBuiltFrom({
  entry,
  // The one-line footnote is orientation for the Library, where "Built from" is
  // reference; the lesson mounts the same box but has already said what the
  // pieces are in its role sections, so it turns the line off.
  footnote = true,
}: {
  entry: LibEntry;
  footnote?: boolean;
}) {
  const pieces = builtFrom(entry);
  if (!pieces.length) return null;

  return (
    <Card>
      <Lbl>Built from</Lbl>
      <div className="flex flex-wrap items-stretch gap-2">
        {pieces.map((p, i) => (
          <Link
            key={`${p.c}-${i}`}
            // A piece with a kanji entry links there; a radical or primitive links
            // to its own library page.
            href={entryHref(p.id)}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-text no-underline hover:bg-panel"
          >
            <span className="text-[30px] leading-none">{p.c}</span>
            {p.meaning ? (
              <span className="text-[12px] text-text-muted">{p.meaning}</span>
            ) : null}
          </Link>
        ))}
      </div>
      {footnote ? (
        <p className="mt-2.5 text-xs text-text-muted">
          Each piece is a shape you can meet on its own.
        </p>
      ) : null}
    </Card>
  );
}
