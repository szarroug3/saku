"use client";

// What a primitive SHAPE is worth — the two sections on its Library page.
//
// Character entry pages now receive their complete component payload by id;
// this small client remains for primitives, whose only live personalization is
// the learner's known-word filter.
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
import {
  kanjiEntry,
  knownWordsUsing,
  usedAsPartIn,
} from "@/lib/library/library-index";
import { entryHref } from "@/lib/library/href";
import type { HistoryFile } from "@/types";

const COMPONENT_USE_CAP = 24;

export function ComponentUses({
  component,
  history,
  divider = false,
}: {
  /** The primitive shape itself. */
  component: string;
  history: HistoryFile;
  /** Open with the hairline divider EntrySurface's Section uses — for a caller
   * (the primitive page) that stacks this directly below another Card-
   * rendering block with nothing else between them. Skipped when this
   * component renders nothing (kanji.length === 0, below), so a divider never
   * floats over empty content. Default false: most callers don't need it. */
  divider?: boolean;
}) {
  const kanji = usedAsPartIn(component);
  // NO `useMemo`, though the join walks all 12,555 vocabulary rows. The React
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
      <Card className={divider ? "mt-5 border-t border-border/50 pt-5" : undefined}>
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
        // Hairline divider (EntrySurface's Section pattern), not WordsWith's
        // own margin: it renders a plain Card too and the two would otherwise
        // read as one run-on block with nothing between them. Wrapped here
        // rather than inside WordsWith, which is also used with nothing above
        // it and needs no divider of its own.
        <div className="mt-5 border-t border-border/50 pt-5">
          <WordsWith words={known} label="Words you know that use it" />
        </div>
      ) : null}
    </>
  );
}
