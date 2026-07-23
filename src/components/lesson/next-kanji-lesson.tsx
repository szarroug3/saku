"use client";

// Up next, once kana is done — the card that stands between a beginner and
// 2,136 kanji in a line. ONE track: it teaches the kanji AND the radical-only
// building blocks they are made of, woven into the same sets (see
// kanji-lesson.ts / packUnits). There is no separate "Radicals" card anymore.
//
// It is the kana card's twin and deliberately not its reuse: that card is made
// of things kanji does not have. A section label ("Vowels あ") to title itself
// with, one reading per character to print, a dakuten row to disclaim, and one
// Tofugu guide that teaches exactly the five characters on it. Kanji has a
// meaning per kanji, a lesson with no name, and no guide anywhere that teaches
// 人 and 大 specifically. Forcing one component to be both would mean a props
// bag of optionals and two branches in every line — two small cards are cheaper
// to read and cheaper to be right.
//
// WHAT IT MAY SAY
// ===============
// Every word is read off src/data/kanji.ts, src/data/radicals.ts or counted from
// them: each character, its first meaning, and — for a kanji — which KANJI of how
// many, a span, "5–8 of 2,136", because a lesson teaches several at once and the
// count of lessons is not a number the app can promise. A radical woven in is its
// OWN tile, labelled a radical and not counted in that span: it is a building
// block the learner meets alongside the kanji, so the number stays a fact about
// Japanese rather than being padded. The size is COST, not a question count — the
// draw+assembly work of learning the shapes (see kanji-lesson.ts) — and it is not
// printed as a raw number, because "cost 10" means nothing to the person doing
// it. The card shows the characters and lets them count.
//
// EACH TILE SAYS WHICH IT IS: a radical-only building block ("Radical · in N
// kanji"), a plain kanji, or a kanji that is also a radical ("Kanji · also
// radical N"). A radical is always ordered before the first kanji that uses it,
// because the set was built that way — component-first.
//
// It does NOT print readings. Not the busy-ness rule, the retrieval one: the
// reading is the answer to what a later word will ask, and a card that shows the
// answer has spent the question. The kana card prints readings because for kana
// the reading IS the material; here the meaning names the kanji and the readings
// are learned later, in words, which is where looking one up belongs.

import Link from "next/link";

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import { kanjiEntry } from "@/data/kanji";
import { radicalEntry } from "@/data/radicals";
import { WHY_TRACK } from "@/data/why";
import type { KanjiLesson, LessonItem } from "@/lib/kanji-lesson";
import { positionLabel } from "@/lib/lesson-position";
import { entryHref } from "@/lib/library/href";
import type { EntryId } from "@/types";
import type { FactId } from "@/types";

/** Where a tile links, and what its role line says. A radical-only shape links to
 * its radical entry and reads "Radical"; a kanji links to its kanji entry and
 * reads "Kanji", or "Kanji · also radical N" when it plays both roles. Radical:気
 * and kanji:気 are different entries, so the link is chosen by the item's kind,
 * never by the glyph alone. */
function tileEntry(item: LessonItem): EntryId {
  return item.kind === "radical" ? radicalEntry(item.glyph) : kanjiEntry(item.glyph);
}

export function NextKanjiLesson({
  lesson,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: KanjiLesson;
  /**
   * Start the lesson. The facts ARE the session — no budget, no length: the
   * unit was decided by the material.
   *
   * `teach: false` is the skip-the-lesson route: drill these now, without the
   * walk. It is the same handler and the same facts on purpose — the two routes
   * differ in whether the walk happens and in nothing else, and page.tsx marks
   * the material seen before the drill either way. See the buttons below.
   */
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know this", over whatever slice the button named. */
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  const { position, spine, cards } = lesson;

  return (
      <Card>
        {/* "kanji 5–8 of 2,136", never "lesson 1 of 1068". The lesson count was
            real arithmetic and still a promise the app couldn't keep — it moves
            with the lesson-length slider and the teaching order while the
            material doesn't. See src/lib/lesson-position.ts. The radicals woven
            into a set are building blocks shown alongside, not part of this count;
            the kanji-less orphan tail counts radicals instead (spine). */}
        <Lbl>Up next · {positionLabel(spine === "kanji" ? "kanji" : "radicals", position)}</Lbl>

        {/* The characters ARE the links, radicals and kanji together — one track.
            Each tile says which it is: a radical-only building block, a kanji, or
            a kanji that is also a radical. A separate "learn it first" block would
            be a second thing to read saying what the tiles already do, and the
            app's own entry page is the guide here. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {cards.map((card) => (
            <Link
              key={`${card.kind}:${card.glyph}`}
              href={entryHref(tileEntry(card))}
              className="min-w-[92px] flex-1 rounded-lg border border-border px-2 pb-2.5 pt-3 text-center text-text no-underline hover:bg-panel"
            >
              <span className="block text-[34px] font-extralight leading-[1.15]">
                {card.glyph}
              </span>
              <span className="mt-1 block text-[13px] text-text-muted">
                {card.meaning}
              </span>
              {/* The role line, one per tile so a mixed set reads honestly:
                  - a radical-only shape says "Radical" and how many kanji it
                    turns up in (the "why learn it now" — this piece is coming
                    back), or nothing when it is an orphan in no common kanji;
                  - a kanji that is also a radical says both roles;
                  - a plain kanji says nothing, and keeps the row height so the
                    tiles line up. */}
              {card.kind === "radical" ? (
                card.appearsIn && card.appearsIn > 0 ? (
                  <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
                    Radical · in {card.appearsIn} kanji
                  </span>
                ) : (
                  <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
                    Radical
                  </span>
                )
              ) : card.alsoRadical ? (
                <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
                  Kanji · also radical {card.alsoRadical}
                </span>
              ) : card.neededFor ? (
                /* A wordless part is in the set because a kanji on the SAME card
                   needs it — never because it is worth knowing on its own — and
                   the kanji it names is always right there. */
                <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
                  You need this for {card.neededFor}
                </span>
              ) : (
                <span className="mt-1 block min-h-[12px]" />
              )}
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
              Start opens a session whose teach phase steps each kanji one at a
              time (session/teach-walk.tsx) and then drills. "Quiz me" skips
              that walk and drills now. Both mark these kanji seen; only the
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
              with no denominator beside a header that counts kanji would read as
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

        {/* Why kanji, and not words or grammar — and how learning a kanji is what
            unlocks the words made of it. Teaching content about the language, so
            it belongs on screen; a pull, so only the lede shows until opened. */}
        <WhyDisclosure why={WHY_TRACK.kanji} />
      </Card>
  );
}
