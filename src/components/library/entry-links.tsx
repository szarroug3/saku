"use client";

// The Links card — ONE ORDER, EVERY KIND.
//
//   1. You've mixed up with      — history. A report.
//   2. Commonly mixed up with    — shape. A prediction.
//   3. everything else           — made of, appears in, your lists.
//
// The two confusion lines hold their positions on every kind's page so the eye
// learns one place to look. Line 1 is ABSENT when you have never mixed the thing
// up — no placeholder, no sentence explaining that it is empty. An empty line is
// already legible; a line about its own emptiness is the app narrating itself.
//
// A WORD HAS NEITHER LINE, and not as a special case: `confusableWith` returns
// [] for words and a word accumulates no shape neighbours, so a word page's
// Links simply starts at "Shares 生". Nothing here tests for the kind.
//
// The old caveat paragraph — "Those just have a similar shape, and the app is
// guessing… A guess never counts against you" — is gone. The line's own label
// says "commonly", the chip says "a guess", and a third statement of it was the
// design defending itself against an objection the reader never made.

import Link from "next/link";
import type { ReactNode } from "react";

import { Card, Hint, Lbl } from "@/components/ui";
import { libEntry } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import type { Mixups } from "@/lib/library/mixups";
import type { EntryId } from "@/types";

export function GlyphLink({ id }: { id: EntryId }) {
  const e = libEntry(id);
  if (!e) return null;
  return (
    <Link href={entryHref(e.id)} className="text-[17px] text-text no-underline">
      {e.glyph}
    </Link>
  );
}

function LinkRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 flex flex-wrap items-center gap-2">{children}</dd>
    </>
  );
}

export function EntryLinks({
  mixups,
  children,
}: {
  mixups: Mixups;
  /** The "everything else" rows — made of, appears in, your lists. Passed as
   * children so each kind supplies only the rows it has, while the two lines
   * above keep their fixed positions regardless. */
  children?: ReactNode;
}) {
  return (
    <Card>
      <Lbl>Links</Lbl>
      <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-[13px] max-[700px]:grid-cols-1">
        {/* 1 — HISTORY. Absent when empty, and NOT a filtered view of the line
            below it: a confusion between two things that look nothing alike is
            the most valuable kind, because no shape analysis would have found
            it. See mixups.ts. */}
        {mixups.confused.length > 0 ? (
          <LinkRow label="You’ve mixed up with">
            {mixups.confused.slice(0, 6).map((id) => (
              <GlyphLink key={id} id={id} />
            ))}
          </LinkRow>
        ) : null}

        {/* 2 — SHAPE. A guess, and it says so once. */}
        {mixups.lookalike.length > 0 ? (
          <LinkRow label="Commonly mixed up with">
            {mixups.lookalike.slice(0, 6).map((id) => (
              <GlyphLink key={id} id={id} />
            ))}
            <span className="rounded-full border border-warning px-1.5 py-0.5 text-[10px] text-warning">
              a guess
            </span>
          </LinkRow>
        ) : null}

        {/* 3 — everything else. */}
        {children}
      </dl>
    </Card>
  );
}

export { LinkRow };

/** "not on any — the bar below can file it" and friends. Re-exported so the
 * page's list row reads the same as the rest of the card. */
export function NoLinks({ children }: { children: ReactNode }) {
  return <Hint>{children}</Hint>;
}
