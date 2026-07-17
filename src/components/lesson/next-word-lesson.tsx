"use client";

// Up next — the words track's lesson card, and the one place the app teaches a
// word outright.
//
// WHY THIS TEACHES IN-APP, UNLIKE KANA
// ====================================
// The kana and kanji cards point OUT — Tofugu for a mnemonic, the entry page to
// look a kanji up — because a glyph is an arbitrary shape you have to be taught.
// A word is not: it is built from parts the user already has. 先生 is 先 + 生,
// せんせい is those two readings, "teacher" is the sum. So the card SHOWS it —
// 先生 · せんせい · teacher — and then the drill checks it. There is no external
// guide to send someone to for "the word 先生", and inventing one would be the
// busy-work the other cards avoid.
//
// WHAT IT MAY SAY, AND WHAT IT MAY NOT
// ====================================
// Every line is read off the word's own row: the written form, the reading, the
// first gloss. A kana word (これ, もう) has no reading line — it IS its reading,
// and printing これ · これ reads as a bug (the same call vocab.ts makes in
// declining to mint a kana word a reading fact). No lesson number of a TOTAL:
// the teachable set grows as the kanji track advances, so "lesson 3 of 40" would
// promise a 40 that moves. The card counts up ("lesson 3") and does not lie
// about the end.

import { Btn, Card, Hint, Lbl } from "@/components/ui";
import type { WordLesson } from "@/lib/word-lesson";
import type { FactId } from "@/types";

export function NextWordLesson({
  lesson,
  onStart,
  onClaim,
}: {
  lesson: WordLesson;
  /** Start the lesson. The facts ARE the session — the count was the unit, so
   * there is no budget and no length to apply. */
  onStart: (facts: FactId[]) => void;
  /** "I already know these", over the lesson's words. */
  onClaim: (facts: FactId[]) => void;
}) {
  const { cards, index } = lesson;

  return (
    <>
      <Card>
        <Lbl>Up next · words · lesson {index}</Lbl>

        <h1 className="text-[22px] font-light tracking-[-0.3px]">
          {cards.map((c) => c.meaning).join(" · ")}
        </h1>
        <p className="mt-0.5 text-[13px] text-text-muted">
          Learn these {cards.length === 1 ? "word" : "words"}, then a quick drill.
        </p>

        {/* The words ARE the lesson — shown outright, word · reading · meaning,
            because a word is built from parts you already know. A kana word has
            no reading line: it is its own reading. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {cards.map((card) => (
            <div
              key={card.keb}
              className="kq-material min-w-[112px] flex-1 rounded-lg border border-border bg-panel px-3 pb-2.5 pt-3 text-center"
            >
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
              <span className="mt-1 block text-[13px] text-text">
                {card.meaning}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Btn onClick={() => onClaim(lesson.facts)}>
            I already know{" "}
            {cards.length === 1 ? "this" : `these ${cards.length}`}
          </Btn>
          <Btn go onClick={() => onStart(lesson.facts)}>
            Start · lesson {index}
          </Btn>
        </div>
      </Card>

      <Card className="px-[15px] py-[13px]">
        <Hint>
          Learning a word also opens up its kanji: once you know a word 生 is in,
          the app starts asking how 生 is read there. Saying you already know
          these adds them to your knowledge base and skips the drill.
        </Hint>
      </Card>
    </>
  );
}
