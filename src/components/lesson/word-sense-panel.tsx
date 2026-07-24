"use client";

// What the character is when it is a WORD: how you say it, and what it means.
//
// WHY IT EXISTS AT ALL
// ====================
// A step on the words track says both in its header — 学生 prints "noun ·
// student" with せいと beside the speaker — so this panel would only repeat it.
// A FOLDED character does not. 人 arrives on the kanji track, so its header is
// the kanji's: the meaning "person", the readings it takes inside other words,
// the role badge promising that this is a word too. Nothing on that screen said
// what the word sounds like or what it means, which is the gap the owner found.
//
// The reading is the headline, because a word you cannot say is not a word you
// have learned, and the speaker sits on the READING rather than on the written
// form: the reading is unambiguous, and the character alone can be read several
// ways.
//
// ALL OF THE READINGS, ONE OF THEM DRILLED
// ========================================
// 人 is three words sharing one shape: ひと a person, じん the -ian suffix, にん
// the counter for people. The vocabulary used to keep whichever one JMdict
// happened to list first, which is how this panel came to teach 人 as a suffix
// and 前 as "previous". It now prints every reading the form has (see
// VocabRow.senses), in the same table idiom as the kanji readings on this page,
// with the beginner's reading first.
//
// One reading is still the one the quiz asks, and the foot says so, because a
// screen that shows three readings and then grades one of them without warning
// is a trap.

import { HearButton } from "@/components/lesson/hear-button";
import { LessonPanel } from "@/components/lesson/lesson-panel";
import type { VocabRow } from "@/data/vocab";
import { wordTypeOf } from "@/lib/lesson-roles";

export function WordSensePanel({
  word,
  voiceName,
}: {
  word: VocabRow;
  voiceName: string;
}) {
  const senses = word.senses;

  // ONE reading is a sentence, not a table. A header row over a single row of
  // data is furniture around one fact, so the single-sense case keeps the shape
  // this panel has always had.
  if (senses.length < 2) {
    const meaning = word.glosses.slice(0, 4).join(", ");
    return (
      <LessonPanel title="How you say it, and what it means">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <HearButton glyph={word.reb} voiceName={voiceName} />
          <span className="font-kana text-[24px] leading-none text-text">{word.reb}</span>
          <span className="text-[11px] uppercase tracking-[0.06em] text-text-muted">
            {wordTypeOf(word)}
          </span>
        </div>
        {meaning ? (
          <p className="mt-2 text-[14px] leading-relaxed text-text">{meaning}</p>
        ) : null}
      </LessonPanel>
    );
  }

  return (
    <LessonPanel title="How you say it, and what it means">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium text-text-muted">
              <th className="py-1.5 pr-2 font-medium">Reading</th>
              <th className="py-1.5 pr-2 font-medium">Kind</th>
              <th className="py-1.5 font-medium">Means</th>
            </tr>
          </thead>
          <tbody>
            {/* Keyed on position, because a reading is not unique within a
                form: コート is a coat and a tennis court, one sound, two rows. */}
            {senses.map((s, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                <td className="py-2 pr-2 align-middle">
                  {/* The speaker sits WITH the thing it speaks, to its left, the
                      same rule the readings table and the entry header follow. */}
                  <span className="flex items-center gap-2">
                    <HearButton glyph={s.reb} voiceName={voiceName} />
                    <span className="font-kana text-[15px]">{s.reb}</span>
                  </span>
                </td>
                <td className="py-2 pr-2 align-middle text-text-muted">
                  {wordTypeOf(s)}
                </td>
                <td className="py-2 align-middle text-text">
                  {s.glosses.slice(0, 4).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-auto pt-2.5 text-[11px] leading-relaxed text-text-muted/80">
        The first reading is the one you will be asked for. The others are here
        because you will meet them, not because they are on the quiz.
      </p>
    </LessonPanel>
  );
}
