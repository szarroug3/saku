"use client";

// The end of the curriculum, made deliberate.
//
// Home's job is "what should I learn next?", answered by a card per track. When
// every track is exhausted — kana, radicals, kanji, words and grammar all with
// no lesson left and no locked-but-started track waiting — those cards all fall
// silent and Home would otherwise be a title over nothing. That is a real place
// a learner can reach, and an empty page reads as a bug, not an achievement.
//
// So this is a SECTION, not a placeholder: it is shown ONLY when the curriculum
// is genuinely finished (page.tsx owns that test), and it does two honest
// things. It acknowledges the finish, and it hands over the two jobs that
// outlast new material: keeping what you know sharp (Practice), and looking
// anything up (Library). It does not invent unfinished curriculum and it does
// not touch progress.

import Link from "next/link";

import { Card, Lbl } from "@/components/ui";

export function CurriculumComplete() {
  return (
    <Card>
      <Lbl>Curriculum complete</Lbl>
      <h2 className="mb-1.5 text-lg font-semibold">
        You&apos;ve learned everything here.
      </h2>
      <p className="mb-4 max-w-prose text-sm text-text-muted">
        There is no new material left to teach. From here the work is keeping
        what you know sharp: review pulls up whatever is closest to slipping, and
        the library is there whenever you want to look something up.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link
          href="/practice"
          className="kq-material rounded-lg border border-transparent bg-text px-3.5 py-[9px] text-sm font-medium text-bg no-underline hover:bg-text"
        >
          Review what you know
        </Link>
        <Link
          href="/library"
          className="kq-material rounded-lg border border-border bg-card px-3.5 py-[9px] text-sm text-text no-underline hover:bg-panel"
        >
          Browse the library
        </Link>
      </div>
    </Card>
  );
}
