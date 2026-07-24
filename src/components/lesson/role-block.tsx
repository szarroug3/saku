"use client";

// The heading over one role's material on a lesson step.
//
// THE HEADING IS NOW THE ONLY ANSWER, SO IT IS ALWAYS THERE
// ========================================================
// 人 is a word, a kanji and a shape other kanji are built around, and the page
// used to say so twice in two vocabularies: a badge in the top right reading
// "Radical · Kanji · Word", and headings down the body reading "As a word", "As
// a kanji", "As a building block" — the same three things, different words, and
// in the opposite order. Two names for one idea is two ideas to a beginner, so
// the badge is gone and these headings carry the whole job. They print the
// badge's exact nouns (Radical, Kanji, Word) in the ladder's own order, and a
// character that plays ONE role gets its one heading too: with nothing in the
// corner any more, this is the only thing on the page naming what the reader is
// looking at.
//
// THE LINE IS THE SUBSTANCE, NOT DECORATION. Each heading is followed by one
// sentence saying what the role means for the person reading, before any data.
// The radical role in particular has no material left on the lesson (the list of
// kanji built on the shape is the Library's), so its line IS the section — a
// heading over nothing was the gap that started all of this.
//
// A BLOCK WITH NO CHILDREN IS LEGITIMATE HERE, for exactly that reason.

import type { ReactNode } from "react";

import type { RoleName } from "@/lib/character-role";

/** What each role means for the character in hand, said once, in the words a
 * beginner has. Every one of them points FORWARD, because a role is a promise
 * about where this character turns up next.
 *
 * They are deliberately three sentences and not one sentence three times. A
 * reader meeting 人 reads all three in a row, and a shared skeleton with the
 * noun swapped would make the three roles look like one fact restated, which is
 * the thing this layout exists to undo. */
const ROLE_HEADING: Record<RoleName, { title: string; lead: string }> = {
  radical: {
    title: "Radical",
    lead: "Other kanji are built on this shape. Learn it now and you will keep spotting it inside them.",
  },
  kanji: {
    title: "Kanji",
    lead: "A character in its own right, and one you will usually meet inside a longer word, pulling its weight in the meaning.",
  },
  word: {
    title: "Word",
    lead: "Nothing else needs attaching. Said on its own, it is already a word.",
  },
};

export function RoleBlock({
  role,
  labelled,
  children,
}: {
  role: RoleName;
  /** Whether to print the heading. False for the steps that play no character
   * role at all — a kana, a grammar pattern, a two-character word — whose
   * sections come back exactly as they were. */
  labelled: boolean;
  /** Optional, because the radical role is taught by its line alone. */
  children?: ReactNode;
}) {
  if (!labelled) return <>{children}</>;
  const { title, lead } = ROLE_HEADING[role];
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[13px] font-semibold text-text">{title}</h3>
        <p className="mt-0.5 text-[12px] leading-snug text-text-muted">{lead}</p>
      </div>
      {children}
    </section>
  );
}
