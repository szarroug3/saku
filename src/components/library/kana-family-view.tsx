"use client";

// "The family" — the other characters built out of this shape.
//
// FULL WIDTH AT THE FOOT, and that is a layout decision with a reason. は needs
// five cells (it takes both ば and ぱ); laid out inside a column that also holds
// the mnemonic, that fifth cell reflows everything above it. Across the foot,
// the widest family in the set costs the rest of the page nothing.
//
// A CELL CARRIES ITS STANDING ON THE GLYPH, NEVER A NUMBER OR A READING. ぎ, キ
// and きゃ are SEPARATE ENTRIES with their own pages and their own scores.
// Printing ぎ's reading next to き's is what made an earlier version of this
// section wrong — the tell was "ki" in rōmaji sitting beside "gi" in kana, two
// entries rendered as one. So a cell is a POINTER: the glyph, coloured by whether
// you are on top of it. The number lives on its own page.
//
// THE STANDING USED TO RIDE A TRAILING DOT, AND THE DOT READ AS PUNCTUATION. A
// lone member (a base kana's Katakana cell is just its twin — あ → ア) rendered
// "ア" followed by a muted 6px circle, which looked like a dangling middot with
// nothing after it. The tone now colours the GLYPH itself — the thing you click —
// so a one-member cell is a clean link and a many-member cell (きゃ · きゅ · きょ)
// separates its glyphs with a middot that only ever sits BETWEEN two of them,
// never trailing one.

import { Fragment } from "react";
import Link from "next/link";

import { Card, Lbl } from "@/components/ui";
import { kanaFact } from "@/data/characters";
import { entryHref } from "@/lib/library/href";
import type { FamilyCell } from "@/lib/library/kana-family";
import { STANDING_TONE, standingOf } from "@/lib/library/standing";
import type { Claims } from "@/lib/claims";
import type { AccuracyMetric, HistoryFile } from "@/types";

/** The chip's tone, as the glyph's own text colour — same source, so a family
 * cell and the page it points at can never disagree about how you're doing. An
 * unstudied member ("mute") stays plain text rather than greyed: it is a live
 * link to a page you have not opened, not a disabled one. */
const TONE_TEXT: Record<"good" | "warn" | "bad" | "mute", string> = {
  good: "text-success",
  warn: "text-warning",
  bad: "text-danger",
  mute: "text-text",
};

export function KanaFamilyView({
  cells,
  facts,
  claims,
  metric,
  now,
}: {
  cells: readonly FamilyCell[];
  facts: HistoryFile["facts"];
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
}) {
  return (
    <Card>
      <Lbl>The family</Lbl>
      {/* `auto-fit` with a minimum rather than a fixed column count: あ has one
          cell and は has four, and neither should be stretched to fill nor
          squeezed to fit a grid sized for the other. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {cells.map((cell) => (
          <div key={cell.title} className="rounded-lg border border-border bg-card p-2.5">
            <p className="mb-1.5 text-[11px] text-text-muted">{cell.title}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[22px] leading-none">
              {cell.members.map((m, i) => {
                const s = standingOf(
                  facts[kanaFact(m.glyph)],
                  claims[kanaFact(m.glyph)],
                  metric,
                  now,
                );
                return (
                  <Fragment key={m.glyph}>
                    {/* BETWEEN members only — a lone member (ア) must not trail a
                        separator with nothing after it. */}
                    {i > 0 ? (
                      <span aria-hidden className="text-[15px] text-text-muted">
                        ·
                      </span>
                    ) : null}
                    <Link
                      href={entryHref(m.entry)}
                      aria-label={`Open ${m.glyph}`}
                      // The glyph text IS the link, coloured by its own standing.
                      className={`no-underline ${TONE_TEXT[STANDING_TONE[s.standing]]}`}
                    >
                      {m.glyph}
                    </Link>
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
