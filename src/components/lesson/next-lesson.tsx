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

import { useState } from "react";

import { WhyDisclosure } from "@/components/lesson/why";
import { TeachMe } from "@/components/lesson/teach-me";
import { Btn, Card, Hint, Lbl } from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
import { WHY_SCRIPT } from "@/data/why";
import type { Lesson } from "@/lib/lesson";
import { setFacts } from "@/lib/lesson";
import type { FactId } from "@/types";

export function NextLesson({
  lesson,
  onQuizMe,
  onClaim,
}: {
  lesson: Lesson;
  /**
   * "Quiz me" — I've learned these (at Tofugu, or in the walkthrough) and
   * they're fair game. Marks the group SEEN (into the knowledge base, drillable)
   * and drops into a drill. It is NOT gated on proving anything first: asking to
   * be quizzed IS the statement that you've seen it, and the drill supplies the
   * accuracy. See the seen vs claimed split in src/lib/claims.ts.
   *
   * Facts and not chars because the runtime is fact-native, and `string[]` here
   * is a seam a branded FactId slides through in silence.
   */
  onQuizMe: (facts: FactId[]) => void;
  /**
   * "I already know these" — I knew them before the app; don't waste my time.
   * Marks the group KNOWN and skips the drill, so the next thing surfaced is the
   * next new material rather than a drill. A different record from "Quiz me", on
   * purpose: what you route to next depends on which you meant.
   */
  onClaim: (facts: FactId[]) => void;
}) {
  const { group, chars, learn } = lesson;
  // The walkthrough is a pull, not the recommendation: Tofugu is what the card
  // points at, and "teach me here" is the quieter alternative for the learner
  // who just wants the glyphs shown once. Closed by default so the card stays
  // the calm thing it is until you ask for it.
  const [teaching, setTeaching] = useState(false);
  const readings = chars
    .map((c) => CHAR_INDEX[c]?.r[0])
    .filter(Boolean)
    .join(" · ");

  // Why THIS script, and only where the question is live: the first group of a
  // script is the juncture a beginner actually asks "why am I starting here?" —
  // day one for hiragana, the hand-off for katakana. On group two onward the
  // answer hasn't changed and repeating it would be the wall of text the pattern
  // exists to avoid. Absent for any script with no entry, so this is silent
  // rather than empty.
  const why = group.index === 1 ? WHY_SCRIPT[group.setId] : undefined;

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

        {/* Why hiragana first (or katakana next), before the where-to-learn and
            the Start below it. Compact and closed by default — it explains the
            language, not the app, so it belongs on screen; but it is a pull, so
            only the one line shows until the reader opens it. */}
        {why ? <WhyDisclosure why={why} /> : null}

        {/* Learn it, THEN be asked. The app has never taught anything with a
            mnemonic and is not about to: Tofugu is the recommended guide and the
            link says whose. "Teach me here" is the other door — a bare
            walkthrough for the learner who doesn't need a mnemonic and would
            rather just see the glyphs than leave the app. */}
        <div className="kq-material mt-4 rounded-lg border border-border bg-panel px-3.5 py-3">
          <p className="text-[13px]">
            <span className="font-medium">Learn them first.</span>{" "}
            <span className="text-text-muted">
              The app asks questions; it doesn&rsquo;t teach with mnemonics.
              Tofugu does — that&rsquo;s the one to use.
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <a
              href={learn.url}
              target="_blank"
              rel="noopener noreferrer"
              className="kq-material cursor-pointer rounded-lg border border-border bg-card px-3.5 py-[7px] text-sm text-text no-underline hover:bg-panel"
            >
              {learn.label} ↗
            </a>
            <Btn
              sel={teaching}
              onClick={() => setTeaching((t) => !t)}
              aria-expanded={teaching}
            >
              Teach me here
            </Btn>
          </div>
          {teaching ? <TeachMe chars={chars} /> : null}
        </div>

        {/* The two intents, kept apart because they route apart. "Quiz me" is
            the go button — it marks the group seen and drills it. "I already
            know these" claims it and skips. See onQuizMe / onClaim above. */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Btn onClick={() => onClaim(lesson.facts)}>
              I already know {chars.length === 1 ? "this" : `these ${chars.length}`}
            </Btn>
            <Btn onClick={() => onClaim(setFacts(group.setId))}>
              I know all {group.setLabel.toLowerCase()}
            </Btn>
          </div>
          <Btn go onClick={() => onQuizMe(lesson.facts)}>
            Quiz me
          </Btn>
        </div>
      </Card>

      <Card className="px-[15px] py-[13px]">
        {/* What each intent actually does, in its own terms — neither is a score
            and neither is a promise. See src/lib/claims.ts. */}
        <Hint>
          Quiz me adds the group to your knowledge base and starts a drill — the
          drill keeps the score, not the button. Saying you already know a group
          adds it too, but skips the drill and takes it out of your way; the app
          takes your word now and checks back in a few months.
        </Hint>
      </Card>
    </>
  );
}
