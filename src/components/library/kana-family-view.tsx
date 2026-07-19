"use client";

// "The family" — the other characters built out of this shape.
//
// FULL WIDTH AT THE FOOT, and that is a layout decision with a reason. は needs
// five cells (it takes both ば and ぱ); laid out inside a column that also holds
// the mnemonic, that fifth cell reflows everything above it. Across the foot,
// the widest family in the set costs the rest of the page nothing.
//
// A CELL CARRIES A STANDING DOT, NEVER A NUMBER OR A READING. ぎ, キ and きゃ are
// SEPARATE ENTRIES with their own pages and their own scores. Printing ぎ's
// reading next to き's is what made an earlier version of this section wrong —
// the tell was "ki" in rōmaji sitting beside "gi" in kana, two entries rendered
// as one. So a cell is a POINTER: the glyph, and a dot saying whether you are on
// top of it. The number lives on its own page.

import Link from "next/link";

import { Card, Lbl } from "@/components/ui";
import { kanaFact } from "@/data/characters";
import { entryHref } from "@/lib/library/href";
import type { FamilyCell } from "@/lib/library/kana-family";
import { STANDING_TONE, standingOf, type Standing } from "@/lib/library/standing";
import type { Claims } from "@/lib/claims";
import type { AccuracyMetric, HistoryFile } from "@/types";

const DOT: Record<"good" | "warn" | "bad" | "mute", string> = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-danger",
  mute: "bg-border",
};

function Dot({ standing }: { standing: Standing }) {
  return (
    <span
      // The chip's tone, as a dot. Same source, so a family cell and the page it
      // points at can never disagree about how you're doing.
      className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[STANDING_TONE[standing]]}`}
      aria-hidden
    />
  );
}

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
            <div className="flex flex-wrap items-center gap-2.5">
              {cell.members.map((m) => {
                const s = standingOf(
                  facts[kanaFact(m.glyph)],
                  claims[kanaFact(m.glyph)],
                  metric,
                  now,
                );
                return (
                  <Link
                    key={m.glyph}
                    href={entryHref(m.entry)}
                    aria-label={`Open ${m.glyph}`}
                    className="flex items-center gap-1.5 text-[22px] leading-none text-text no-underline"
                  >
                    {m.glyph}
                    <Dot standing={s.standing} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
