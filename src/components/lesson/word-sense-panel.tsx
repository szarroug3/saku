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
// THE READINGS THAT STAND ALONE, AND ONLY THOSE
// =============================================
// This panel used to print all three of 人's readings — ひと, じん, にん — under
// the "Word" heading. Two of them are not words. じん is the -ian suffix and にん
// counts people; neither is ever said by itself, and a table filed under "Word"
// claims they are. The owner's reading of it: "when it's used as a word, it's
// said exactly one way hito". The sounds a character makes welded into something
// longer are the kanji block's, where they now are.
//
// So it asks `standaloneSenses`, which keeps every reading of the same word class
// as the primary. That is one row for 人 and four for 主 (あるじ, おも, しゅ,
// ぬし are four genuine words), so the plural case stays and no "there is only
// one" assumption is baked in anywhere below.
//
// One reading is still the one the quiz asks, and the foot says so whenever
// there is more than one on show, because a screen that lists four readings and
// then grades one of them without warning is a trap.

import { HearButton } from "@/components/lesson/hear-button";
import { LessonPanel } from "@/components/lesson/lesson-panel";
import type { VocabRow } from "@/data/vocab";
import { standaloneSenses, wordTypeOf } from "@/lib/lesson-roles";

/** What the panel is FOR, in one line, because the kanji block above it now has
 * a table of sounds too and the difference between the two is the whole point.
 * That one is the character welded into something longer; this one is the
 * character with nothing attached. Two lines, not one with a number swapped: a
 * word with four readings has a fact about it that a word with one does not. */
const LEAD_ONE =
  "Alone in a sentence, with no other character attached, it is said this one way.";
const LEAD_MANY =
  "Alone in a sentence, with no other character attached, it can be any of these, and the meaning turns on which you say.";

export function WordSensePanel({
  word,
  voiceName,
}: {
  word: VocabRow;
  voiceName: string;
}) {
  const senses = standaloneSenses(word);
  const only = senses.length === 1 ? senses[0] : null;

  // ONE reading is a sentence, not a table. A header row over a single row of
  // data is furniture around one fact, so the single-reading case keeps the shape
  // this panel has always had.
  if (only) {
    const meaning = only.glosses.slice(0, 4).join(", ");
    return (
      <LessonPanel title="How you say it, and what it means">
        <p className="mb-2.5 text-[12px] leading-snug text-text-muted">{LEAD_ONE}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <HearButton glyph={only.reb} voiceName={voiceName} />
          <span className="font-kana text-[24px] leading-none text-text">{only.reb}</span>
          <span className="text-[11px] uppercase tracking-[0.06em] text-text-muted">
            {wordTypeOf(only)}
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
      <p className="mb-2.5 text-[12px] leading-snug text-text-muted">{LEAD_MANY}</p>
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
