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
import { useFlatSurface } from "@/components/ui";
import { PitchReading } from "@/components/library/pitch-mark";
import { StandingChip } from "@/components/library/standing-chip";
import { wordPitch } from "@/data/pitch";
import { wordUnitFacts, type VocabRow } from "@/data/vocab";
import { allReadingSenses, isBoundReading, wordTypeOf } from "@/lib/lesson-roles";
import type { Standing } from "@/lib/library/standing";
import type { FactId } from "@/types";

// The Library shows how each reading is going right beside the reading; the
// lesson teach view does not (it is teaching, not grading). So the standing is
// an OPTIONAL lookup the caller supplies. When absent the panel renders exactly
// as it always has — no chips, no extra column — which is what the lesson wants.
// A counter/number is NOT a VocabRow — it is a hand-authored counted form with
// exactly one reading and one meaning (see src/data/counters.ts), and its facts
// are keyed on the form's own ids, not the vocab-keb minters wordUnitFacts uses.
// So a counter cannot flow through the `word` path; it hands the panel this
// already-resolved single sense instead, and the panel renders it with the SAME
// one-reading "sentence" layout a single-reading word gets (SenseSentence). This
// is the small adapter the brief prefers over forking the component: one panel,
// one "How you say it, and what it means" heading, counter honesty on the ids.
export interface CounterSense {
  /** The reading to show and speak — いっぽん, or the glyph itself for a kana
   * form (ひとつ). */
  readonly reading: string;
  /** The muted tag in the reading row — "counter" or "number", the counter's
   * analogue of a word's part-of-speech. */
  readonly kind: string;
  /** The plain-language gloss — "one long thin object". */
  readonly meaning: string;
  /** How the reading is going. Null for a kana form, which mints no reading fact
   * (its reading IS the glyph), the same rule a kana word follows. */
  readonly readingStanding: Standing | null;
  /** How the meaning is going. Always present — every counter form has a meaning
   * fact. */
  readonly meaningStanding: Standing | null;
}

/**
 * ONE reading, rendered as a sentence rather than a table — the shared shape a
 * single-reading word and a counter both use. A header row over a single data
 * row is furniture around one fact, so this stays flat. Extracted so the word
 * and counter callers cannot draw the same one-reading case two different ways.
 */
function SenseSentence({
  reb,
  kind,
  meaning,
  pitch,
  voiceName,
  readingStanding,
  meaningStanding,
  transparent,
}: {
  reb: string;
  kind: string;
  meaning: string;
  /** The downstep to draw the pitch overline at, or null for no verified pitch. */
  pitch: number | null;
  voiceName: string;
  readingStanding: Standing | null;
  meaningStanding: Standing | null;
  /** Flat look on the Library entry page — drops the panel's frosty fill. */
  transparent: boolean;
}) {
  return (
    <LessonPanel title="How you say it, and what it means" transparent={transparent}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <HearButton glyph={reb} voiceName={voiceName} />
        {pitch != null ? (
          <PitchReading
            reading={reb}
            downstep={pitch}
            className="font-kana text-[24px] leading-none text-text"
          />
        ) : (
          <span className="font-kana text-[24px] leading-none text-text">{reb}</span>
        )}
        <span className="text-[11px] uppercase tracking-[0.06em] text-text-muted">
          {kind}
        </span>
        {/* The reading's standing rides beside the reading it is about — the
            same place the multi-row table puts it. Absent in the lesson, where
            no lookup is passed. */}
        {readingStanding ? <StandingChip standing={readingStanding} /> : null}
      </div>
      {meaning ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-relaxed text-text">
          <span>{meaning}</span>
          {meaningStanding ? <StandingChip standing={meaningStanding} /> : null}
        </p>
      ) : meaningStanding ? (
        <p className="mt-2">
          <StandingChip standing={meaningStanding} />
        </p>
      ) : null}
    </LessonPanel>
  );
}

export function WordSensePanel({
  word,
  voiceName,
  standings,
  counter,
}: {
  word?: VocabRow;
  voiceName: string;
  standings?: (factId: FactId) => Standing | null;
  counter?: CounterSense;
}) {
  // On the Library entry page this panel renders FLAT (transparent fill, border
  // kept); in the lesson teach view no provider sits above, so it stays bg-panel.
  // Read once and handed to every LessonPanel this component draws.
  const transparent = useFlatSurface();
  // A counter's single sense arrives pre-resolved — it has no VocabRow to
  // enumerate — and renders through the SAME one-reading layout a word does. No
  // pitch: a counted form carries no verified per-word pitch (pitch is keyed on a
  // vocab keb, which a counter has none of).
  if (counter) {
    return (
      <SenseSentence
        reb={counter.reading}
        kind={counter.kind}
        meaning={counter.meaning}
        pitch={null}
        voiceName={voiceName}
        readingStanding={counter.readingStanding}
        meaningStanding={counter.meaningStanding}
        transparent={transparent}
      />
    );
  }
  // Every other caller drives the panel from a VocabRow. The optional-`word`
  // signature exists only so the counter branch above can omit it; a word caller
  // always passes one, so this guard never fires for them.
  if (!word) return null;

  const senses = allReadingSenses(word);
  const only = senses.length === 1 ? senses[0] : null;

  // `allReadingSenses` matches `readingUnits`/`wordUnitFacts` 1:1 (same count,
  // same reb, same order — all group by reading), so a sense at position i owns
  // the reading and meaning fact ids at the same index here. The reading fact is
  // null for a kana word, which mints no reading question.
  const unitFacts = standings ? wordUnitFacts(word.keb) : null;
  const readingStanding = (i: number): Standing | null => {
    const id = unitFacts?.[i]?.reading;
    return id && standings ? standings(id) : null;
  };
  const meaningStanding = (i: number): Standing | null => {
    const id = unitFacts?.[i]?.meaning;
    return id && standings ? standings(id) : null;
  };

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
    return (
      <SenseSentence
        reb={only.reb}
        kind={wordTypeOf(only)}
        meaning={only.glosses.slice(0, 4).join(", ")}
        pitch={drawsPitch(only.reb) ? pitch : null}
        voiceName={voiceName}
        readingStanding={readingStanding(0)}
        meaningStanding={meaningStanding(0)}
        transparent={transparent}
      />
    );
  }

  return (
    <LessonPanel title="How you say it, and what it means" transparent={transparent}>
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
                      same rule the readings table and the entry header follow.
                      The reading's standing (Library only) rides after it. */}
                  <span className="flex flex-wrap items-center gap-2">
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
                    {readingStanding(i) ? (
                      <StandingChip standing={readingStanding(i)!} />
                    ) : null}
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
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{s.glosses.slice(0, 4).join(", ")}</span>
                    {meaningStanding(i) ? (
                      <StandingChip standing={meaningStanding(i)!} />
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LessonPanel>
  );
}
