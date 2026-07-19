"use client";

// The kanji lesson's first row: what this character is BUILT FROM, and what it
// is easy to MISTAKE IT FOR.
//
// WHY THESE TWO SHARE A ROW
// =========================
// They are the same question asked in two directions. "Built from" says 休 is 化
// beside 木 — a shape you can decompose because you already have the pieces.
// "Look out for" says 休 is not 体 — a shape you can confuse because you already
// have the neighbour. Both are only sayable when the reader has the OTHER
// character, and both are what makes a new kanji stop being an arbitrary
// arrangement of strokes. Side by side they read as one thought: here is what is
// inside it, here is what sits next to it.
//
// THE COMMON CASE IS ONE OF THEM, OR NEITHER
// ==========================================
// Measured over the whole jōyō set: 16 kanji have both, 331 have parts only, 61
// have a lookalike only (before the known-filter, which only ever shrinks that
// number), and 1,728 have neither. So the full-width fallback is not an edge
// case to be tidy about — it is the path most characters take — and the absent
// row is the path most characters take after that. `PairedRow` owns both rules.
//
// BUILT FROM IS ALL-OR-NOTHING, and that is `teachableParts`' decision, not this
// component's. A kanji whose components include a raw KRADFILE primitive (｜ ノ
// マ) yields null rather than a filtered list, because "made of 日" is a false
// statement about 明. Same helper the drill's hint button asks, so the lesson and
// the hint cannot disagree about what a character is made of.
//
// NO STANDING, NO DATES. A lookalike is shown because the reader knows it; how
// WELL they know it is a score, and a lesson step shows no scores. In particular
// there is no "you learned this 3 days ago" line — that is a standing written
// out as prose, on the one screen whose promise is that nothing here is graded.

import Link from "next/link";

import { LessonPanel, PairedRow } from "@/components/lesson/lesson-panel";
import { kanjiEntry } from "@/data/kanji";
import { knownLookalikes } from "@/lib/kanji-lookalikes";
import { teachableParts } from "@/lib/kanji-parts";
import { entryHref } from "@/lib/library/href";
import type { HistoryFile } from "@/types";

/** One character with its meaning, as a link to its own page. The shared tile
 * both halves use, so a part and a lookalike are visibly the same KIND of thing
 * — a character you already have — and only the heading says which. */
function CharTile({ c, meaning }: { c: string; meaning: string }) {
  return (
    <Link
      href={entryHref(kanjiEntry(c))}
      className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-text no-underline hover:bg-panel"
    >
      <span className="text-[20px] leading-none">{c}</span>
      {meaning ? <span className="text-[11px] text-text-muted">{meaning}</span> : null}
    </Link>
  );
}

export function KanjiPartsRow({
  glyph,
  history,
}: {
  glyph: string;
  history: HistoryFile;
}) {
  const parts = teachableParts(glyph);
  const lookalikes = knownLookalikes(glyph, history);

  const builtFrom = parts ? (
    <LessonPanel title="Built from">
      <div className="flex flex-wrap items-center gap-2">
        {parts.map((p, i) => (
          <span key={`${p.c}-${i}`} className="flex items-center gap-2">
            {/* The plus is a real character between the tiles rather than a
                border, so it wraps with them on a narrow screen instead of
                leaving a rule floating in a gap. */}
            {i > 0 ? <span className="text-text-muted">+</span> : null}
            <CharTile c={p.c} meaning={p.meaning} />
          </span>
        ))}
      </div>
      <p className="mt-auto pt-2.5 text-[11px] leading-relaxed text-text-muted/80">
        Each piece is a character you have already learned on its own.
      </p>
    </LessonPanel>
  ) : null;

  const lookOutFor = lookalikes.length ? (
    <LessonPanel title="Look out for">
      <div className="flex flex-wrap items-center gap-2">
        {lookalikes.map((l) => (
          <CharTile key={l.c} c={l.c} meaning={l.meaning} />
        ))}
      </div>
      <p className="mt-auto pt-2.5 text-[11px] leading-relaxed text-text-muted/80">
        {lookalikes.length === 1 ? "This one is" : "These are"} easy to read as{" "}
        <span className="text-text">{glyph}</span> at speed. Look at what is
        different.
      </p>
    </LessonPanel>
  ) : null;

  return <PairedRow wide={builtFrom} narrow={lookOutFor} even />;
}
