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
//
// THE SECOND LINE IS NOW PER-KIND, REUSING THE LIBRARY'S OWN SUMMARY, NOT A
// WORD-ONLY GLOSS (SAK-78 round 6). Sam: "for words, you show the definition
// in the side panel. for kana, can you show the pronunciation and find
// something for all tracks." The old line was `factInfo(firstFact).meaning` —
// correct for a word (its gloss is a fact's `meaning`), wrong for everything
// else that ISN'T a definition: a kana's "meaning" is silence, so the line was
// blank there, and a kanji/grammar/keigo/counter/verb-pair/radical row got
// whatever its first fact's `meaning` happened to hold, which is not always
// the right field for that kind (a grammar fact's `meaning` is a reading-drill
// gloss, not the pattern's rule).
//
// `entryDetail` below asks the Library's own `subLabel` (sub-label.ts) instead
// — the exact function EntryTile/EntryRow already use for "the one line under
// the glyph" on every Library shelf, per kind: a kana's readings (pronunciation),
// a word's/kanji's meanings (gloss), a primitive's "Kanji part", and a single
// reading or first meaning for everything else (grammar, keigo, transitivity,
// counters, radicals) that doesn't need its own special case. Reusing it here
// means this panel can never show a kind a different one-line rule than the
// Library shelf that kind already has.
//
// SENTENCE TIERS ARE THE ONE EXCEPTION, AND FOR A REAL REASON, NOT A MISSED
// CASE. A tier has no Library entry of its own under `sentenceTierEntry`
// (`sentence-ordering:<id>`, sentence-track.ts) — the Library shelves a tier as
// a MARK entry instead (`writing-rule:sentence-rule-<id>`, see marks.ts and
// entries.ts's `knownFactsOf`), which is the id by-subject.tsx's
// SentenceSubjectRow now hands this panel (see its own comment for why). That
// mark entry carries `readings: []` (marks are notation, not sound — see
// marks.ts's "NO READINGS" note) and `meanings: [tier name]`, so `subLabel`'s
// generic fallback on it would just print the tier's own name a second time
// under itself. The mark's `sub` field is exactly the line this panel wants
// instead — the tier's one-line ordering rule ("Base sentence ordering: anchor
// the ending, then place core meaning and context around it"), the same text
// the entry page already sub-heads the tier with. So `entryDetail` special-
// cases `SENTENCE_RULE_KIND` to read `sub` rather than asking `subLabel` to
// answer a question its generic rule isn't built for.

import * as React from "react";
import Link from "next/link";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

import {
  getEntryBreakdownRows,
  type EntryBreakdownRow,
} from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import { japaneseFontClass } from "@/lib/japanese-text";
import { BUCKET_LABEL } from "@/components/stats/tally";
import { SidePanel } from "@/components/stats/side-panel";
import type { Standing } from "@/lib/library/standing";
import type { EntryId } from "@/types";

const EMPTY_IDS: EntryId[] = [];

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
  // SAK-104: name/detail/href per entry used to come from direct calls into
  // the (now server-only) library index and fact registry. One batched
  // Server Action fetch per open, instead of one guarded call per row — see
  // getEntryBreakdownRows's own header. Fetched only while the panel is open
  // (`open ? [...] : null` skips the request while closed, same guard
  // library-page.tsx's own useServerLookup calls use).
  const allIds = groups.length > 0 ? groups.flatMap((g) => g.entries) : EMPTY_IDS;
  const rows = useServerLookup(getEntryBreakdownRows, open ? [allIds] : null);

  return (
    <SidePanel open={open} label={label} onClose={onClose} testId="entry-breakdown">
      {groups.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nothing here.</p>
      ) : !rows ? (
        <p className="text-[13px] text-text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map((g) => (
            <StatusSection
              key={g.standing}
              standing={g.standing}
              entries={g.entries}
              rows={rows}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </SidePanel>
  );
}

function StatusSection({
  standing,
  entries,
  rows,
  onClose,
}: {
  standing: Standing;
  entries: readonly EntryId[];
  rows: Record<string, EntryBreakdownRow>;
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
            const row = rows[e as unknown as string];
            const name = row?.name ?? e;
            const detail = row?.detail ?? null;
            return (
              <li key={e}>
                <Link
                  href={row?.href ?? "#"}
                  onClick={onClose}
                  className="flex items-baseline justify-between gap-3 hover:underline"
                >
                  <span className={japaneseFontClass(name)}>{name}</span>
                  {detail ? (
                    <span className="truncate text-right text-text-muted">
                      {detail}
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
