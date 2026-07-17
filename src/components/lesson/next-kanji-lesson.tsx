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
// first meaning, and which lesson of how many. The size is COST, not a question
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
import { ClaimExplainer } from "@/components/lesson/claim-explainer";
import { WhyDisclosure } from "@/components/lesson/why";
import { kanjiEntry } from "@/data/kanji";
import { WHY_TRACK } from "@/data/why";
import type { KanjiLesson } from "@/lib/kanji-lesson";
import { entryHref } from "@/lib/library/href";
import type { FactId } from "@/types";

export function NextKanjiLesson({
  lesson,
  onStart,
  onClaim,
}: {
  lesson: KanjiLesson;
  /** Start the lesson. The facts ARE the session — no budget, no length: the
   * unit was decided by the material. */
  onStart: (facts: FactId[]) => void;
  /** "I already know this", over whatever slice the button named. */
  onClaim: (facts: FactId[]) => void;
}) {
  const { group, cards, over } = lesson;

  return (
    <>
      <Card>
        <Lbl>
          Up next · kanji · lesson {group.index} of {group.total}
        </Lbl>

        <h1 className="text-[22px] font-light tracking-[-0.3px]">
          {cards.map((c) => c.meaning).join(" · ")}
        </h1>
        <p className="mt-0.5 text-[13px] text-text-muted">
          Look each one up, then come back.
        </p>

        {/* The one warning this card owes. A single kanji (or a set that can
            only be learned together) can be bigger than the lesson length you
            asked for and cannot be cut smaller — so the app says so rather than
            quietly handing you a lesson over your limit. Honest and specific:
            the kanji is right there to see how big. */}
        {over ? (
          <p className="mt-2 rounded-lg border border-border bg-panel px-3 py-2 text-[12px] text-text-muted">
            {cards.length === 1
              ? "This is one large kanji — bigger than your usual lesson, and it can't be split."
              : "These must be learned together and are bigger than your usual lesson."}
          </p>
        ) : null}

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
              {/* A wordless part is in the lesson because something else on the
                  SAME card needs it — never because it is worth knowing on its
                  own — and the kanji it names is always right there. */}
              {card.neededFor ? (
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
          <Btn go onClick={() => onStart(lesson.facts)}>
            Start · lesson {group.index}
          </Btn>
        </div>

        {/* Why kanji, and not words or grammar — and how learning a kanji is what
            unlocks the words made of it. Teaching content about the language, so
            it belongs on screen; a pull, so only the lede shows until opened. */}
        <WhyDisclosure why={WHY_TRACK.kanji} />
      </Card>

      <ClaimExplainer>
        Saying you know these adds them to your knowledge base and takes them
        out of your way. The app takes your word for it now, and comes back to
        check in a few months.
      </ClaimExplainer>
    </>
  );
}
