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
// ways (人 is じん, にん, ひと and more, depending on the company it keeps).

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
