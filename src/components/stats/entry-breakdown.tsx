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
// A GROUP ROW'S PANEL IS A FLAT UNION OF CHILD SUBJECTS, NOT GROUPED BY THEM.
// Clicking "Vocabulary"'s met count still opens one list mixing radicals,
// kanji and words rather than three subject-labelled sections. That part of
// the SAK-78 round-2 judgment call is unchanged — see by-subject.tsx's
// GroupRow. What the list IS now grouped by is STATUS (below), a different
// axis entirely: a Vocabulary-wide panel shows "Claimed" / "Solid" / …
// sections, each one still mixing radicals/kanji/words inside it.
//
// GROUPED BY STATUS, COLLAPSIBLE, BUCKETS ORDER (SAK-78 round 5). Sam's ask:
// "the side panel should separate by status. the sections should be
// collapsible and ordered in the same order as the what you know area at the
// top so claimed → solid → …". tally.ts's `groupEntriesByStanding` does the
// actual grouping (and documents, at length, the tension with this file's own
// "an entry is never given a standing" rule above — read that function's
// header before changing the rule). This component only renders what it's
// handed: a `groups` prop, already ordered, not a flat `entries` list. The
// caller (by-subject.tsx) computes the groups, because it — not this panel —
// owns the entry→facts scoping (`Subject.entryFacts`) the grouping needs to
// stay honest with `metEntries`.
//
// SECTIONS DEFAULT OPEN. All of a row's met entries were a flat, fully-visible
// list before this round; starting every section collapsed would make the
// panel show LESS on open than it did last round for the exact same click,
// which reads as a regression, not a feature. Collapsing is for narrowing an
// already-open panel down, not the panel's own opening state. Worth a second
// look once real data shows how many sections a busy subject (Vocabulary)
// actually renders — flagged in the round-5 Linear comment.

import * as React from "react";
import Link from "next/link";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

import { factInfo, factsOf, glyphOf } from "@/lib/facts";
import { entryHref } from "@/lib/library/href";
import { BUCKET_LABEL } from "@/components/stats/tally";
import { SidePanel } from "@/components/stats/side-panel";
import type { Standing } from "@/lib/library/standing";
import type { EntryId } from "@/types";

export function EntryBreakdown({
  open,
  label,
  groups,
  onClose,
}: {
  open: boolean;
  /** The panel's title, already formatted by the caller ("70 met"), same
   * convention as BucketBreakdown's `label`. */
  label: string;
  /** Entries already grouped and ordered by tally.ts's
   * `groupEntriesByStanding` — see that function's header for the grouping
   * rule and this file's header for why the rule lives there, not here. */
  groups: readonly { standing: Standing; entries: readonly EntryId[] }[];
  onClose: () => void;
}) {
  return (
    <SidePanel open={open} label={label} onClose={onClose} testId="entry-breakdown">
      {groups.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nothing here.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map((g) => (
            <StatusSection key={g.standing} standing={g.standing} entries={g.entries} onClose={onClose} />
          ))}
        </div>
      )}
    </SidePanel>
  );
}

function StatusSection({
  standing,
  entries,
  onClose,
}: {
  standing: Standing;
  entries: readonly EntryId[];
  onClose: () => void;
}) {
  return (
    <CollapsiblePrimitive.Root
      defaultOpen
      data-testid={`entry-breakdown-section-${standing}`}
      className="border-b border-border py-2 last:border-b-0"
    >
      <CollapsiblePrimitive.Trigger
        data-testid={`entry-breakdown-section-${standing}-trigger`}
        className="group flex w-full cursor-pointer items-center justify-between gap-2 text-left text-[12px] font-semibold tracking-wide text-text-muted hover:text-text"
      >
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block transition-transform group-data-[state=open]:rotate-90"
          >
            &#9656;
          </span>
          {BUCKET_LABEL[standing]}
        </span>
        <span className="tabular-nums">{entries.length}</span>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content>
        <ul className="flex flex-col gap-2.5 pt-2 text-[13px]">
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
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}
