"use client";

// A radical's kanji, as a learning-ordered TABLE.
//
// The flat row of glyphs ComponentUses shows for a jōyō kanji answers "what is
// this a part of?" and nothing else. A radical wants more from the same list:
// the whole point of learning the shape is the MEANING it lends the kanji built
// on it, so each kanji here earns a row that names its meaning and shows how the
// reader is doing on it. The order is the curriculum order the kanji track
// teaches in (kanji.ts `orderRow(c).i`), not frequency, so the top of the table
// is the kanji the reader is about to meet rather than ones far off.
//
// ONE COMPONENT, TWO CAPS. The Library entry page shows up to 30 with a "· N
// more" overflow line; the lesson teach card shows up to 5. Same sort, same
// rows — only the cap differs, so both callers share this file rather than
// authoring the table twice.

import Link from "next/link";

import { StandingChip } from "@/components/library/standing-chip";
import { Card, Hint, Lbl } from "@/components/ui";
import { kanjiEntry, kanjiRow, meaningFactId, orderRow } from "@/data/kanji";
import { usedAsPartIn } from "@/lib/library/components";
import { entryHref } from "@/lib/library/href";
import { standingOf } from "@/lib/library/standing";
import type { Claims } from "@/lib/claims";
import type { AccuracyMetric, HistoryFile } from "@/types";

export function RadicalKanjiTable({
  component,
  cap,
  facts,
  claims,
  metric,
  now,
}: {
  /** The radical glyph whose kanji this table lists. */
  component: string;
  /** How many rows to show before the overflow line. */
  cap: number;
  facts: HistoryFile["facts"];
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
}) {
  const kanji = usedAsPartIn(component);
  if (kanji.length === 0) return null;

  // Kanji learning order: `orderRow(c).i` is the 0-based position in the default
  // teaching order. Anything the order does not name sinks to the bottom.
  const ordered = [...kanji].sort(
    (a, b) => (orderRow(a)?.i ?? Infinity) - (orderRow(b)?.i ?? Infinity),
  );
  const shown = ordered.slice(0, cap);
  const rest = ordered.length - shown.length;

  return (
    <Card>
      <Lbl>Used as a part in</Lbl>
      <div className="flex flex-col gap-1.5">
        {shown.map((c) => {
          const meaning = kanjiRow(c)?.meanings.slice(0, 2).join(", ") ?? "";
          const s = standingOf(
            facts[meaningFactId(c)],
            claims[meaningFactId(c)],
            metric,
            now,
          );
          return (
            <div key={c} className="flex flex-wrap items-baseline gap-2 text-[13px]">
              <Link
                href={entryHref(kanjiEntry(c))}
                className="text-[16px] text-text no-underline"
              >
                {c}
              </Link>
              <span className="min-w-0 flex-1 truncate text-text-muted">{meaning}</span>
              <StandingChip standing={s.standing} />
            </div>
          );
        })}
      </div>
      {rest > 0 ? (
        <div className="mt-2.5">
          <Hint>· {rest} more</Hint>
        </div>
      ) : null}
      <p className="mt-2.5 text-xs text-text-muted">
        {ordered.length === 1
          ? "1 kanji is written with this shape."
          : `${ordered.length} kanji are written with this shape.`}
      </p>
    </Card>
  );
}
