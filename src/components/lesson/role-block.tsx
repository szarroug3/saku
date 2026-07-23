"use client";

// The heading over one role's material, on a character that plays several.
//
// 人 is a word, a kanji and a shape other kanji are built around, and its lesson
// now shows all three. Three roles' sections stacked with no seam read as one
// long undifferentiated page, and the reader has no way to tell that the
// readings table belongs to a different claim than the list of kanji built from
// the shape. So each role's run of sections gets a heading and one line saying
// what the role means for this character.
//
// ONLY WHEN THERE ARE SEVERAL. A plain kanji's lesson is entirely about being a
// kanji, and captioning its readings "As a kanji" would be labelling the only
// thing on the page. The caller passes `labelled: false` there and gets its
// sections back untouched, which is how every single-role step keeps the screen
// it had before roles were a set.

import type { ReactNode } from "react";

import type { RoleName } from "@/lib/character-role";

/** What each role means for the character in hand, said once, in the words a
 * beginner has. These answer the question the badge raises: it names three
 * roles, and this is what each of them buys you. */
const ROLE_HEADING: Record<RoleName, { title: string; lead: string }> = {
  word: {
    title: "As a word",
    lead: "It carries a sound and a meaning of its own.",
  },
  kanji: {
    title: "As a kanji",
    lead: "It counts as a character in its own right, and these are the readings it takes inside words.",
  },
  radical: {
    title: "As a building block",
    lead: "Other kanji are built around this shape.",
  },
};

export function RoleBlock({
  role,
  labelled,
  children,
}: {
  role: RoleName;
  /** Whether to print the heading. False on a single-role step, where the
   * sections are returned exactly as they were. */
  labelled: boolean;
  children: ReactNode;
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
