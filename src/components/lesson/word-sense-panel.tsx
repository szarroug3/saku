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
//
// ONE TABLE, ALWAYS
// =================
// Every word and counter renders as the SAME Reading | Kind | Means table — a
// single-reading word (天) is a one-row table, not a sentence, so it reads the
// same as a multi-reading word (大). The owner's call: "all word pages should be
// formatted the same even if they have only one pronunciation." A counter/number
// is NOT a VocabRow — it is a hand-authored counted form with exactly one reading
// and one meaning (see src/data/counters.ts), and its facts are keyed on the
// form's own ids, not the vocab-keb minters wordUnitFacts uses. So a counter
// cannot flow through the `word` path; it hands the panel this already-resolved
// single sense, which the panel turns into a one-row table like any other.

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
// an OPTIONAL lookup the caller supplies. When absent the panel renders no chips.
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

/** One row of the say-it table — a reading, its kind, its meaning, and (Library
 * only) the standing of each. A word builds one per reading-unit; a counter
 * builds a single one. */
interface SenseRow {
  reb: string;
  kind: string;
  /** The muted "in compounds" tag on a bound, non-primary reading (おお, じん,
   * にん). The primary reading is always sayable alone, so it is never marked. */
  bound: boolean;
  meaning: string;
  /** The downstep to draw the pitch overline at, or null for no verified pitch. */
  pitch: number | null;
  readingStanding: Standing | null;
  meaningStanding: Standing | null;
}

/** The ONE shape every word and counter uses: a Reading | Kind | Means table.
 * A single-reading word (or a counter) is a one-row table, so every page reads
 * the same whether it has one reading or several. */
function SenseTable({
  rows,
  voiceName,
  transparent,
}: {
  rows: readonly SenseRow[];
  voiceName: string;
  /** Flat look on the Library entry page — drops the panel's frosty fill. */
  transparent: boolean;
}) {
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
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                <td className="py-2 pr-2 align-middle">
                  {/* The speaker sits WITH the thing it speaks, to its left, the
                      same rule the readings table and the entry header follow.
                      The reading's standing (Library only) rides after it. */}
                  <span className="flex flex-wrap items-center gap-2">
                    <HearButton glyph={r.reb} voiceName={voiceName} />
                    {r.pitch != null ? (
                      <PitchReading
                        reading={r.reb}
                        downstep={r.pitch}
                        className="font-kana text-[15px]"
                      />
                    ) : (
                      <span className="font-kana text-[15px]">{r.reb}</span>
                    )}
                    {r.readingStanding ? (
                      <StandingChip standing={r.readingStanding} />
                    ) : null}
                  </span>
                </td>
                <td className="py-2 pr-2 align-middle text-text-muted">
                  {r.kind}
                  {/* A reading you only ever say welded into a longer word — おお
                      for 大, じん/にん for 人. It is drilled and so it is shown, but
                      the tag keeps the reader from thinking they can utter it on
                      its own. */}
                  {r.bound ? (
                    <span className="ml-1.5 text-[10px] uppercase tracking-[0.06em] text-text-muted opacity-70">
                      in compounds
                    </span>
                  ) : null}
                </td>
                <td className="py-2 align-middle text-text">
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{r.meaning}</span>
                    {r.meaningStanding ? (
                      <StandingChip standing={r.meaningStanding} />
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
  const transparent = useFlatSurface();

  // A counter's single sense arrives pre-resolved — it has no VocabRow to
  // enumerate — and becomes a one-row table like any single-reading word. No
  // pitch: a counted form carries no verified per-word pitch (pitch is keyed on a
  // vocab keb, which a counter has none of).
  if (counter) {
    const row: SenseRow = {
      reb: counter.reading,
      kind: counter.kind,
      bound: false,
      meaning: counter.meaning,
      pitch: null,
      readingStanding: counter.readingStanding,
      meaningStanding: counter.meaningStanding,
    };
    return <SenseTable rows={[row]} voiceName={voiceName} transparent={transparent} />;
  }

  // Every other caller drives the panel from a VocabRow. The optional-`word`
  // signature exists only so the counter branch above can omit it; a word caller
  // always passes one, so this guard never fires for them.
  if (!word) return null;

  const senses = allReadingSenses(word);

  // `allReadingSenses` matches `readingUnits`/`wordUnitFacts` 1:1 (same count,
  // same reb, same order — all group by reading), so a sense at position i owns
  // the reading and meaning fact ids at the same index here. The reading fact is
  // null for a kana word, which mints no reading question.
  const unitFacts = standings ? wordUnitFacts(word.keb) : null;
  const standingFor = (id: FactId | null | undefined): Standing | null =>
    id && standings ? standings(id) : null;

  // The pitch overline is stored per WORD and validated against its PRIMARY
  // reading (word.reb) — the same reading the drill reveal and the Library header
  // draw it on. So it is drawn only on that reading; another reading of the same
  // word (何's なん beside its primary なに) has no verified pitch of its own and
  // stays plain. Display only, never graded. See pitch-mark.tsx / src/data/pitch.ts.
  const pitch = wordPitch(word.keb);

  const rows: SenseRow[] = senses.map((s, i) => ({
    reb: s.reb,
    kind: wordTypeOf(s),
    // Never on the first row: the primary is the reading the word is filed and
    // said under, and is always sayable alone.
    bound: i > 0 && isBoundReading(s),
    meaning: s.glosses.slice(0, 4).join(", "),
    pitch: pitch != null && s.reb === word.reb ? pitch : null,
    readingStanding: standingFor(unitFacts?.[i]?.reading),
    meaningStanding: standingFor(unitFacts?.[i]?.meaning),
  }));

  return <SenseTable rows={rows} voiceName={voiceName} transparent={transparent} />;
}
