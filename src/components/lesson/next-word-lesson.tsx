"use client";

// Up next — the words track's lesson card, and the one place the app teaches a
// word outright.
//
// WHY THIS CARD LEADS WITH THE GATE
// =================================
// Words are taught in beginnerRank order — best first — and most of the top-
// ranked words are kanji-gated: 何 is rank 1 and needs 何, 言う is #3 and needs
// 言. The old card stepped silently over those and taught the best word it COULD,
// which buried the reason the good words weren't showing. The owner wanted the
// opposite lead: name the word the curriculum most wants to teach next AND the
// kanji standing in its way, so the card pushes kanji from day one instead of
// hiding the dependency. See topWordGate in word-lesson.ts.
//
// So the card has two shapes, decided by the top-ranked unlearned word:
//   - GATED (its kanji aren't all known) → LEAD with the gate: the word, and the
//     missing kanji linked to the Library, "learn these to unlock it". The best
//     words you CAN already learn are still offered, but as a clearly-secondary
//     "or practise…" affordance, not the headline.
//   - TEACHABLE (kana-only, or every kanji known) → the normal lesson, whose head
//     IS that top word. Unchanged from before: the words ARE the lesson, shown
//     outright word · reading · meaning, because a word is built from parts you
//     already know.
//
// WHAT IT MAY SAY, AND WHAT IT MAY NOT
// ====================================
// Every line is read off the word's own row: the written form, the reading, the
// first gloss. A kana word (これ, もう) has no reading line — it IS its reading,
// and printing これ · これ reads as a bug. The GATED lead prints no reading at
// all: the word isn't teachable yet, and its reading is exactly what learning it
// later will teach, so showing it would spend the question. No lesson number of
// a TOTAL: the teachable set grows as the kanji track advances, so "lesson 3 of
// 40" would promise a 40 that moves. The card counts up ("lesson 3").

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import type { Why } from "@/data/why";
import { WHY_TRACK } from "@/data/why";
import { positionLabel } from "@/lib/lesson-position";
import type { WordLesson, WordLock } from "@/lib/word-lesson";
import type { FactId } from "@/types";

const WORD_LOCK_WHY: Why = {
  lede: {
    strong: "Words are made up of kanji and radicals.",
    rest: "A word waits until you know every kanji in it.",
  },
  paras: [
    "A word written with kanji you have not met is just shapes. So a word waits until you know the kanji inside it, and then it arrives ready to read.",
    "By default, we use commonality for ordering but this can be updated in the settings.",
  ],
};

export function NextWordLesson({
  lesson,
  lock,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: WordLesson | null;
  lock: WordLock | null;
  /**
   * Start a lesson. The facts ARE the session — the count was the unit, so
   * there is no budget and no length to apply.
   *
   * `teach: false` is the skip-the-lesson route: drill these words now, without
   * the walk. Same handler either way, which is what guarantees the kanji
   * readings these words prove get unlocked on both routes — that unlock is a
   * consequence of meeting the word, not of paging through a screen about it.
   */
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know these", over the lesson's words. */
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  return (
    <Card>
      {lock ? (
        <LockedLead away={lock.away} />
      ) : lesson ? (
        <TeachableLesson
          lesson={lesson}
          onStart={onStart}
          onClaim={onClaim}
          inSession={inSession}
          onContinue={onContinue}
        />
      ) : null}

      <WhyDisclosure why={lock ? WORD_LOCK_WHY : WHY_TRACK.words} />
    </Card>
  );
}

function LockedLead({ away }: { away: number }) {
  return (
    <>
      <Lbl>Up next · words</Lbl>
      <p className="mt-0.5 text-[13px] text-text-muted">
        You are {away} kanji away from learning the next set of words.
      </p>
    </>
  );
}

/** The normal lesson — the top word is teachable, so the words ARE the lesson,
 * shown outright. Unchanged behaviour from before the gate. */
function TeachableLesson({
  lesson,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: WordLesson;
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  const { cards, position } = lesson;

  return (
    <>
      {/* This card showed no count at all until now, on the reasoning that the
          words track has no honest end. It has one — 6,213 curriculum words —
          the thing it lacks is an honest number of LESSONS, which is why the
          label counts words. See src/lib/lesson-position.ts. */}
      <Lbl>Up next · {positionLabel("words", position)}</Lbl>

      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card) => (
          <WordTile key={card.keb} card={card} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={() => onClaim(lesson.facts)}>
          I already know {cards.length === 1 ? "this" : `these ${cards.length}`}
        </Btn>
        {/* The two routes into the words, in kana's arrangement — see the long
            note on next-kanji-lesson.tsx for the argument. Start shows each word
            (word · reading · meaning, stepped) and then drills it; "Quiz me"
            drills now. Both mark the words seen AND unlock the kanji readings
            those words prove, because that unlock follows from meeting the word
            rather than from having read a screen about it.

            Plain "Start", for the reason the kanji card gives: a bare lesson
            ordinal is a second scale contradicting the one in the label. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn onClick={() => onStart(lesson.facts, { teach: false })}>
            Quiz me
          </Btn>
          {inSession && onContinue ? (
            <Btn go onClick={onContinue}>
              Continue session
            </Btn>
          ) : (
            <Btn go onClick={() => onStart(lesson.facts)}>
              Start
            </Btn>
          )}
        </div>
      </div>
    </>
  );
}

/** One word, shown word · reading · meaning. A kana word has no reading line: it
 * is its own reading, so printing これ · これ reads as a bug. */
function WordTile({ card }: { card: WordLesson["cards"][number] }) {
  return (
    <div className="min-w-[112px] flex-1 rounded-lg border border-border px-3 pb-2.5 pt-3 text-center">
      <span className="block font-kana text-[26px] font-extralight leading-[1.2]">
        {card.keb}
      </span>
      {card.reb ? (
        <span className="mt-0.5 block font-kana text-[13px] text-text-muted">
          {card.reb}
        </span>
      ) : (
        <span className="mt-0.5 block min-h-[16px]" />
      )}
      <span className="mt-1 block text-[13px] text-text">{card.meaning}</span>
    </div>
  );
}
