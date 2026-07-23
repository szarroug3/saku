"use client";

// Up next, once kana is done — the card that stands between a beginner and
// 2,136 kanji in a line.
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
// Every word is read off src/data/kanji.ts or counted from it: the kanji, their
// first meaning, and which KANJI of how many — a span, "5–8 of 2,136", because
// a lesson teaches several at once and the count of lessons is not a number the
// app can promise. The size is COST, not a question
// count — the draw+assembly work of learning the shapes (see kanji-lesson.ts) —
// and it is not printed as a raw number, because "cost 10" means nothing to the
// person doing it. The card shows the kanji and lets them count.
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
import { WHY_TRACK } from "@/data/why";
import type { KanjiLesson } from "@/lib/kanji-lesson";
import { positionLabel } from "@/lib/lesson-position";
import { entryHref } from "@/lib/library/href";
import type { FactId } from "@/types";

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
  const { position, cards } = lesson;

  return (
      <Card>
        {/* "kanji 5–8 of 2,136", never "lesson 1 of 1068". The lesson count was
            real arithmetic and still a promise the app couldn't keep — it moves
            with the lesson-length slider and the teaching order while the
            material doesn't. See src/lib/lesson-position.ts. */}
        <Lbl>Up next · {positionLabel("kanji", position)}</Lbl>

        {/* The kanji ARE the links. A separate "learn it first" block would be a
            second thing to read saying what the tiles already do, and the app's
            own entry page is the guide here: it prints the meaning, the readings
            and the word each reading is proved by. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {cards.map((card) => (
            <Link
              key={card.c}
              href={entryHref(kanjiEntry(card.c))}
              className="min-w-[92px] flex-1 rounded-lg border border-border px-2 pb-2.5 pt-3 text-center text-text no-underline hover:bg-panel"
            >
              <span className="block text-[34px] font-extralight leading-[1.15]">
                {card.c}
              </span>
              <span className="mt-1 block text-[13px] text-text-muted">
                {card.meaning}
              </span>
              {/* Both roles on one card: this kanji is also a Kangxi radical, so
                  it earns no separate radical lesson — the line says the second
                  role the dropped card would have. */}
              {card.alsoRadical ? (
                <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
                  Also radical {card.alsoRadical}
                </span>
              ) : null}
              {/* A wordless part is in the lesson because something else on the
                  SAME card needs it — never because it is worth knowing on its
                  own — and the kanji it names is always right there. */}
              {card.neededFor ? (
                <span className="mt-1 block text-[10px] leading-tight text-text-muted/80">
                  You need this for {card.neededFor}
                </span>
              ) : !card.alsoRadical ? (
                <span className="mt-1 block min-h-[12px]" />
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
