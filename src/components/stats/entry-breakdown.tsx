"use client";

// The side panel behind a clickable by-subject row (SAK-78 follow-up review:
// "these should be clickable to show the sidebar too for their items", about
// by-subject.tsx's "70 of 2,136 kanji" rows).
//
// ENTRIES, NOT FACTS — the opposite population from bucket-breakdown.tsx's
// panel, and deliberately so. by-subject.tsx's own header comment is explicit
// that "AN ENTRY IS NEVER GIVEN A STANDING": a row's number counts entries met
// (生 counts once, however many of its nine readings you've seen), not facts
// in a standing. So this panel lists `metEntries()`'s own output (by-
// subject.tsx) — the exact walk that produced the row's number — rather than
// re-deriving a fact-shaped list and grouping it back up by entry, which is
// the move by-subject.tsx's header comment already rejects once (an entry
// picking up a standing by averaging its facts).
//
// THE SHELL IS SHARED, THE ROW IS NOT. side-panel.tsx's `SidePanel` is the
// same Dialog/kq-surface/slide-in shell bucket-breakdown.tsx's panel uses —
// see that file for why it's Radix Dialog and why the surface has no
// backdrop-filter. What's here is only the entry row: `glyphOf` + a meaning
// borrowed from the entry's first fact (an entry itself carries no meaning of
// its own in facts.ts — only a FactInfo does), and `entryHref` for the link,
// the same two calls entry-tile.tsx and bucket-breakdown.tsx both already
// make from a different starting point (an entry they already have, or a
// fact they chain `entryOf` off of).
//
// A GROUP ROW'S PANEL IS A FLAT UNION, NOT GROUPED BY CHILD SUBJECT. Clicking
// "Vocabulary"'s met count opens one list mixing radicals, kanji and words
// rather than three labelled sections. That mirrors bucket-breakdown.tsx's
// own panel, which never subdivides a standing's facts by subject either —
// one panel, one flat list, consistent across both breakdown kinds on this
// page. A grouped view (one section per child subject) is a legitimate
// alternative — see by-subject.tsx's GroupRow, whose own comment flags this
// as a judgment call rather than an obviously-correct default.

import * as React from "react";
import Link from "next/link";

import { factInfo, factsOf, glyphOf } from "@/lib/facts";
import { entryHref } from "@/lib/library/href";
import { SidePanel } from "@/components/stats/side-panel";
import type { EntryId } from "@/types";

export function EntryBreakdown({
  open,
  label,
  entries,
  onClose,
}: {
  open: boolean;
  /** The panel's title, already formatted by the caller ("70 met"), same
   * convention as BucketBreakdown's `label`. */
  label: string;
  entries: readonly EntryId[];
  onClose: () => void;
}) {
  return (
    <SidePanel open={open} label={label} onClose={onClose} testId="entry-breakdown">
      {entries.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2.5 text-[13px]">
          {entries.map((e) => {
            // An entry has no meaning of its own (facts.ts) — only its facts
            // do, and they share one where the notion applies (a word's
            // gloss), so the first fact's is the entry's. `factsOf` answers
            // empty for a stranger id, same courtesy factInfo extends in
            // bucket-breakdown.tsx.
            const firstFact = factsOf(e)[0];
            const meaning = firstFact ? factInfo(firstFact)?.meaning : null;
            return (
              <li key={e}>
                <Link
                  href={entryHref(e)}
                  onClick={onClose}
                  className="flex items-baseline justify-between gap-3 hover:underline"
                >
                  <span className="font-kana">{glyphOf(e)}</span>
                  {meaning ? (
                    <span className="truncate text-right text-text-muted">
                      {meaning}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SidePanel>
  );
}
