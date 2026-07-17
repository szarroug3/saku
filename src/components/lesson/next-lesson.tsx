"use client";

// Up next — the one card that stands between a new user and 214 characters.
//
// WHAT IT IS FOR
// ==============
// Day one used to be: pick a length, press Start, read 214 characters off one
// screen. Nothing there was false, and all of it was useless. This card is the
// same information cut at the joint the material already has — one group, five
// characters, and the two things you actually want on that screen: where to
// learn them, and a way to say you already have.
//
// IT HOLDS NO STATE, AND THAT IS THE DESIGN
// =========================================
// There is no "current lesson" here, in cfg, or on disk. `nextLesson(history)`
// is a function of what you know, so the card is a view of history and nothing
// else. Finish the vowels and the k-row appears because the vowels stopped being
// new — not because anything advanced a pointer. Claim all of hiragana and ア
// appears the same way. A cursor would be a second copy of the truth, and the
// first copy is already on disk.
//
// WHAT IT MAY SAY
// ===============
// Every word on it is read off `src/data/characters.ts` or counted from it: the
// label, the characters, their readings, which group of how many. "Group 1 of
// 27" is COUNTED — hiragana has twenty-seven sections, and a card that promised
// ten would be caught out at the eleventh by the user who kept going.

import { Btn, Card, Hint, Lbl } from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
import type { Lesson } from "@/lib/lesson";
import { setFacts } from "@/lib/lesson";
import type { FactId } from "@/types";

export function NextLesson({
  lesson,
  onStart,
  onClaim,
}: {
  lesson: Lesson;
  /** Start the lesson. The lesson's FACTS are the session — no budget, no
   * length: the unit was decided by the material. Facts and not chars because
   * the runtime is fact-native, and `string[]` here is a seam a branded FactId
   * slides through in silence. */
  onStart: (facts: FactId[]) => void;
  /** "I already know this", over whatever slice the button named. */
  onClaim: (facts: FactId[]) => void;
}) {
  const { group, chars, learn } = lesson;
  const readings = chars
    .map((c) => CHAR_INDEX[c]?.r[0])
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Card>
        <Lbl>
          Up next · {group.setLabel.toLowerCase()} · group {group.index} of{" "}
          {group.total}
        </Lbl>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-[22px] font-light tracking-[-0.3px]">
              {group.label}
            </h1>
            <p className="mt-0.5 text-[13px] text-text-muted">{readings}</p>
            {/* The same honesty the kanji lesson owes its parts, in the one
                place kana owes anything: a dakuten row is not a new set of
                shapes, and saying so is the difference between five characters
                and five characters you already half know. */}
            {group.extended ? (
              <p className="mt-1.5 text-[11px] text-text-muted/80">
                Built from kana you&rsquo;ve already seen, with a mark added.
              </p>
            ) : null}
          </div>
          <p className="font-kana text-[34px] font-extralight leading-tight tracking-[3px] opacity-85">
            {chars.join("")}
          </p>
        </div>

        {/* Learn it, THEN be asked. The app has never taught anything and is
            not about to start pretending: the guide is someone else's and the
            link says whose. */}
        <div className="kq-material mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel px-3.5 py-3">
          <p className="text-[13px]">
            <span className="font-medium">Learn them first.</span>{" "}
            <span className="text-text-muted">
              The app asks questions; it doesn&rsquo;t teach. Tofugu does.
            </span>
          </p>
          <a
            href={learn.url}
            target="_blank"
            rel="noopener noreferrer"
            className="kq-material cursor-pointer rounded-lg border border-border bg-card px-3.5 py-[7px] text-sm text-text no-underline hover:bg-panel"
          >
            {learn.label} ↗
          </a>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Btn onClick={() => onClaim(lesson.facts)}>
              I already know {chars.length === 1 ? "this" : `these ${chars.length}`}
            </Btn>
            <Btn onClick={() => onClaim(setFacts(group.setId))}>
              I know all {group.setLabel.toLowerCase()}
            </Btn>
          </div>
          <Btn go onClick={() => onStart(lesson.facts)}>
            Start · {group.label}
          </Btn>
        </div>
      </Card>

      <Card className="px-[15px] py-[13px]">
        {/* What the claim actually does, in the claim's own terms. It is not a
            score and it is not a promise — see src/lib/claims.ts. */}
        <Hint>
          Saying you know a group adds it to your knowledge base and takes it out
          of your way. The app takes your word for it now, and comes back to
          check in a few months.
        </Hint>
      </Card>
    </>
  );
}
