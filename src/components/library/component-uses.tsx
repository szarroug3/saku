"use client";

// What a SHAPE is worth — the two sections a component gets, wherever it is
// shown.
//
// A component is 日 or it is ノ, and those live on different pages: 日 is a
// jōyō kanji with an entry page already, ノ is one of the 82 primitives with no
// entry at all and a page of its own at /radical/ノ. What they have in common
// is exactly this pair of questions, so this file answers them once and both
// pages mount it. Writing it twice is how the kanji page ends up sorting by
// frequency and the radical page by stroke count.
//
//   "Used as a part in"        — the kanji built from this shape. Reference.
//   "Words you know that use it" — the reader's own vocabulary, seen through it.
//
// THE SECOND ONE IS ABSENT WHEN EMPTY, never an empty card with a line
// explaining that it is empty. A new user knows no words and would otherwise
// meet this heading over blank space on every component page in the app; the
// Links card's own header settles this ("An empty line is already legible; a
// line about its own emptiness is the app narrating itself").
//
// THE FIRST ONE IS CAPPED AND SAYS SO. 一 is a part of 400 kanji and 口 of 381.
// See COMPONENT_USE_CAP for why the number is the finding and the list is only
// a sample of it.

import Link from "next/link";

import { WordsWith } from "@/components/library/words-with";
import { Card, Hint, Lbl } from "@/components/ui";
import { kanjiEntry } from "@/data/kanji";
import { COMPONENT_USE_CAP, knownWordsUsing, usedAsPartIn } from "@/lib/library/components";
import { entryHref } from "@/lib/library/href";
import type { Claims } from "@/lib/claims";
import type { AccuracyMetric, HistoryFile } from "@/types";

export function ComponentUses({
  component,
  history,
  claims,
  metric,
  now,
}: {
  /** The shape itself — a jōyō kanji, or one of the 82 primitives. */
  component: string;
  history: HistoryFile;
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
}) {
  const kanji = usedAsPartIn(component);
  // NO `useMemo`, though the join walks all 12,553 vocabulary rows. The React
  // Compiler is on in this repo and memoises it for free; a hand-written
  // useMemo here is one it refuses to preserve (the early return below sits
  // between it and its use), so the manual version bought a lint error and
  // less memoisation than doing nothing.
  const known = knownWordsUsing(component, history);

  // Nothing is built from this shape, so there is nothing downstream of it
  // either — no list, no words, no section. 74 jōyō kanji land here.
  if (kanji.length === 0) return null;

  const shown = kanji.slice(0, COMPONENT_USE_CAP);
  const rest = kanji.length - shown.length;

  return (
    <>
      <Card>
        <Lbl>Used as a part in</Lbl>
        <div className="flex flex-wrap items-center gap-2.5">
          {shown.map((c) => (
            <Link
              key={c}
              href={entryHref(kanjiEntry(c))}
              className="text-[22px] leading-none text-text no-underline"
            >
              {c}
            </Link>
          ))}
          {/* The true total, in the same shape the entry page's "Appears in"
              row uses for its own overflow. 376 more is the interesting number
              on this page and it is not going to be rendered as 376 links. */}
          {rest > 0 ? <Hint>· {rest} more</Hint> : null}
        </div>
        <p className="mt-2.5 text-xs text-text-muted">
          {kanji.length === 1
            ? "1 kanji is written with this shape."
            : `${kanji.length} kanji are written with this shape.`}
        </p>
      </Card>

      {known.length > 0 ? (
        <WordsWith
          words={known}
          label="Words you know that use it"
          facts={history.facts}
          claims={claims}
          metric={metric}
          now={now}
        />
      ) : null}
    </>
  );
}
