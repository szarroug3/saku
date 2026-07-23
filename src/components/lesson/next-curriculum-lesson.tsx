"use client";

// Up next, once kana is done: the one card the whole curriculum comes through.
//
// ONE CARD, BECAUSE IT IS ONE CLIMB
// =================================
// This was the kanji card, sitting above a second card for words. The two ran
// separate schedulers over the same material and printed separate counters, so a
// learner doing one climb read two odometers, and the words card spent most of
// its life saying "you are 12 kanji away", which is a card apologising for the
// card above it. curriculum-order.ts put every radical, kanji and word into a
// single order and curriculum-lesson.ts cuts it into lessons, so there is one
// card and it teaches whatever the next lesson holds: a radical-only shape, the
// kanji it is welded to, and the words those kanji have just paid for.
//
// It is still the kana card's twin and still deliberately not its reuse: that
// card has a section label ("Vowels あ") to title itself with, a dakuten row to
// disclaim, and a Tofugu guide that teaches exactly the five characters on it.
// This one has a meaning per item, a lesson with no name, and no guide anywhere
// that teaches 人 and 大 specifically.
//
// WHAT IT MAY SAY
// ===============
// Every word is read off src/data/kanji.ts, src/data/radicals.ts and
// src/data/vocab.ts, or counted from them: each item, its first meaning, and
// where the lesson sits, one segment per kind of thing on it: "Radical 3–4 of
// 90 · Kanji 5–8 of 2,136 · Word 12 of 6,213". A span per kind, because a
// lesson teaches several at once and the count of lessons is not a number it can
// promise. See src/lib/lesson-position.ts. The size is COST (the work of the
// shapes plus a flat price per word, see curriculum-lesson.ts) and it is not
// printed as a raw number, because "cost 10" means nothing to the person doing
// it. The card shows the items and lets them count.
//
// EACH TILE SAYS WHAT IT IS FOR, in the same words the entry page uses: every
// role the character plays, in one order — "Radical · Kanji · Word", "Kanji ·
// Word", "Radical" — no number, no count (see src/lib/character-role.ts). A
// character can be doing all three jobs at once, and the tile shows every one of
// them. A radical is always ordered before the first kanji that uses it, and a
// word always after the kanji it is written with, because the sequence was built
// that way.
//
// READINGS: A WORD PRINTS ITS OWN, A KANJI PRINTS NONE. Not the busy-ness rule,
// the retrieval one. A kanji's reading is the answer a later word will ask for,
// and a card that shows the answer has spent the question. A word's reading is
// this lesson's own material, drilled the moment the lesson ends, so it is shown
// outright, exactly as the words card showed it.

import Link from "next/link";

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import { kanjiEntry } from "@/data/kanji";
import { radicalEntry } from "@/data/radicals";
import { wordEntry } from "@/data/vocab";
import { WHY_TRACK } from "@/data/why";
import { characterRoleTitle } from "@/lib/character-role";
import type {
  CurriculumLesson,
  CurriculumLessonItem,
} from "@/lib/curriculum-lesson";
import { compositePositionLabel } from "@/lib/lesson-position";
import { entryHref } from "@/lib/library/href";
import type { EntryId } from "@/types";
import type { FactId } from "@/types";

/** Where a tile links. A character goes to its KANJI page when it has one, so a
 * both-role shape lands on the card that carries its readings and its "also
 * radical N" line; a radical-only shape goes to its radical page; a written form
 * that is only ever a word goes to the word. radical:気, kanji:気 and word:気 are
 * three entries, so the link is chosen by the roles, never by the glyph alone. */
function tileEntry(item: CurriculumLessonItem): EntryId {
  if (item.roles.includes("kanji")) return kanjiEntry(item.glyph);
  if (item.roles.includes("radical")) return radicalEntry(item.glyph);
  return wordEntry(item.glyph);
}

export function NextCurriculumLesson({
  lesson,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: CurriculumLesson;
  /**
   * Start the lesson. The facts ARE the session — no budget, no length: the
   * unit was decided by the material.
   *
   * `teach: false` is the skip-the-lesson route: drill these now, without the
   * walk. It is the same handler and the same facts on purpose, because the two
   * routes differ in whether the walk happens and in nothing else, and
   * home-feed.tsx marks the material seen (and unlocks the readings the lesson's
   * words prove) before the drill either way. See the buttons below.
   */
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know this", over whatever slice the button named. */
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  const { position, cards } = lesson;

  return (
      <Card>
        {/* "Radical 3–4 of 90 · Kanji 5–8 of 2,136 · Word 12 of 6,213", never
            "lesson 1 of 1068". The lesson count was real arithmetic and still a
            promise the app couldn't keep: it moves with the lesson-length
            slider while the material doesn't. One segment per kind of thing the
            lesson teaches, so a card holding a radical, two kanji and a word
            counts all four instead of naming one number and dropping the rest.
            See src/lib/lesson-position.ts. */}
        <Lbl>Up next · {compositePositionLabel(position)}</Lbl>

        {/* The items ARE the links, radicals, kanji and words together, one
            track. Each tile says what it is: a building block, a kanji, a word
            you can already say, or any mix of those. A separate "learn it first"
            block would
            be a second thing to read saying what the tiles already do, and the
            app's own entry page is the guide here. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {cards.map((card) => (
            <Link
              key={card.glyph}
              href={entryHref(tileEntry(card))}
              className="min-w-[92px] flex-1 rounded-lg border border-border px-2 pb-2.5 pt-3 text-center text-text no-underline hover:bg-panel"
            >
              <span className="block font-kana text-[34px] font-extralight leading-[1.15]">
                {card.glyph}
              </span>
              {/* A word shows its reading, because that reading is what this
                  lesson teaches. A kanji shows none: see the header. */}
              {card.reading ? (
                <span className="mt-0.5 block font-kana text-[13px] text-text-muted">
                  {card.reading}
                </span>
              ) : null}
              <span className="mt-1 block text-[13px] text-text-muted">
                {card.meaning}
              </span>
              {/* The role line, the same label the entry page uses: every role
                  this character plays, in one order — "Radical · Kanji · Word"
                  for 山, "Kanji · Word" for 何, "Radical" for a shape that is
                  only ever a part. No number, no count, just what it is for. A
                  wordless part keeps its "you need this for X" note underneath,
                  because that is a reason it is here, not a role. */}
              <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
                {characterRoleTitle(card.glyph)}
              </span>
              {card.neededFor ? (
                <span className="mt-0.5 block text-[10px] leading-tight text-text-muted/80">
                  You need this for {card.neededFor}
                </span>
              ) : null}
            </Link>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Btn onClick={() => onClaim(lesson.facts)}>
            I already know{" "}
            {cards.length === 1 ? "this" : `these ${cards.length}`}
          </Btn>
          {/* THE TWO ROUTES INTO THE MATERIAL, in kana's arrangement.
              ========================================================
              Start opens a session whose teach phase steps each item one at a
              time (session/teach-walk.tsx) and then drills. "Quiz me" skips
              that walk and drills now. Both mark these items seen; only the
              first shows them to you first.

              This card used to have Start and nothing else — the comment here
              said "there is no separate 'walk me through', the one button
              teaches then asks", which was true and was also the gap. The claim
              explainer at the top of home promises you can "skip just the lesson
              and go straight to the quiz", and that promise was only kept on
              kana. It is kept here now, in kana's own shape: a quiet secondary
              beside the accented go button, in ONE group on the right, the same
              way next-lesson.tsx offers "Quiz me on all hiragana so far" beside
              "Quiz me on these only".

              WHY THIS IS TWO BUTTONS AND NOT THREE
              ------------------------------------
              Read as a row it is still the same two decisions the card always
              posed: on the left, do I need this lesson at all; on the right, how
              do I take it. The claim is the exit and keeps its own side. The
              skip is not a third intent — it is Start without the walk — so it
              lives in Start's group, unaccented, and reads as a modifier of the
              button beside it rather than a rival to it.

              The label is "Quiz me" and not "Skip the lesson" because the app
              already has this button, on the kana card, under that exact word.
              A second name for the same route would be a second thing to learn,
              and "skip" names what you lose where "Quiz me" names what you get.

              Just "Start", still. It used to say "Start · lesson N", which is
              the lesson-counting the label above stopped doing — and an ordinal
              with no denominator beside a header that counts items would read as
              a second, contradicting scale. */}
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

        {/* Why the three kinds arrive together, and how learning a kanji is what
            unlocks the words made of it. Teaching content about the language, so
            it belongs on screen; a pull, so only the lede shows until opened. */}
        <WhyDisclosure why={WHY_TRACK.curriculum} />
      </Card>
  );
}
