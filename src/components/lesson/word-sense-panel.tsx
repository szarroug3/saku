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
// EVERY READING THE QUIZ ASKS, BOUND ONES MARKED
// ==============================================
// This panel shows all of a word's reading-units — for 大 both だい and おお, for
// 人 all of ひと, じん and にん — because those are exactly the readings the drill
// mints a fact for (see `readingUnits`/`wordUnitFacts` in vocab.ts). It used to
// ask `standaloneSenses`, which kept only the readings you can utter alone, so 大
// taught だい and 人 taught ひと while the quiz went on asking おお, じん and にん:
// the learner met those readings first as a question with an answer they had
// never been shown. Teaching all of them closes that gap, and the rows here now
// match `readingUnits` 1:1.
//
// SOME OF THEM YOU ONLY SAY IN COMPOUNDS, and the panel says so quietly. おお is
// a prefix, じん the -ian suffix, にん the people-counter: real readings, drilled,
// but never uttered standing alone. `isBoundReading` flags them and the row wears
// a muted "in compounds" tag, so showing the reading does not tell the learner
// they can pronounce 大 as おお by itself. The PRIMARY reading (the one the word
// is filed under) is always the one you can say, so the first row is never
// marked.

import { HearButton } from "@/components/lesson/hear-button";
import { LessonPanel } from "@/components/lesson/lesson-panel";
import { PitchReading } from "@/components/library/pitch-mark";
import { wordPitch } from "@/data/pitch";
import type { VocabRow } from "@/data/vocab";
import { allReadingSenses, isBoundReading, wordTypeOf } from "@/lib/lesson-roles";

export function WordSensePanel({
  word,
  voiceName,
}: {
  word: VocabRow;
  voiceName: string;
}) {
  const senses = allReadingSenses(word);
  const only = senses.length === 1 ? senses[0] : null;

  // The pitch overline is stored per WORD and validated against its PRIMARY
  // reading (word.reb) — the same reading the drill reveal and the Library header
  // draw it on. So it is drawn only on that reading; another reading of the same
  // word (何's なん beside its primary なに) has no verified pitch of its own and
  // stays plain. Display only, never graded. See pitch-mark.tsx / src/data/pitch.ts.
  const pitch = wordPitch(word.keb);
  const drawsPitch = (reb: string) => pitch != null && reb === word.reb;

  // ONE reading is a sentence, not a table. A header row over a single row of
  // data is furniture around one fact, so the single-reading case keeps the shape
  // this panel has always had.
  if (only) {
    const meaning = only.glosses.slice(0, 4).join(", ");
    return (
      <LessonPanel title="How you say it, and what it means">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <HearButton glyph={only.reb} voiceName={voiceName} />
          {drawsPitch(only.reb) ? (
            <PitchReading
              reading={only.reb}
              downstep={pitch!}
              className="font-kana text-[24px] leading-none text-text"
            />
          ) : (
            <span className="font-kana text-[24px] leading-none text-text">{only.reb}</span>
          )}
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
                    {drawsPitch(s.reb) ? (
                      <PitchReading
                        reading={s.reb}
                        downstep={pitch!}
                        className="font-kana text-[15px]"
                      />
                    ) : (
                      <span className="font-kana text-[15px]">{s.reb}</span>
                    )}
                  </span>
                </td>
                <td className="py-2 pr-2 align-middle text-text-muted">
                  {wordTypeOf(s)}
                  {/* A reading you only ever say welded into a longer word — おお
                      for 大, じん/にん for 人. It is drilled and so it is shown, but
                      the tag keeps the reader from thinking they can utter it on
                      its own. Never on the first row: the primary is the reading
                      the word is filed and said under. */}
                  {i > 0 && isBoundReading(s) ? (
                    <span className="ml-1.5 text-[10px] uppercase tracking-[0.06em] text-text-muted opacity-70">
                      in compounds
                    </span>
                  ) : null}
                </td>
                <td className="py-2 align-middle text-text">
                  {s.glosses.slice(0, 4).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LessonPanel>
  );
}
