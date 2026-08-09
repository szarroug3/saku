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
// QUIZZED READINGS PLUS DICTIONARY REFERENCE READINGS
// ==================================================
// The teaching table includes every reading-unit the quiz asks — for 大 both だい
// and おお, for 人 all of ひと, じん and にん. On a Library page, a second table may
// also include a source-only or exceptionally uncommon JMdict alternate such as
// 寒い/さぶい. That is reference information, not a new scored fact: restoring
// current dictionary detail must not silently rewrite a learner's history. A
// source-only row therefore has no standing chip.
//
// SOME OF THEM YOU ONLY SAY IN COMPOUNDS, and the panel says so quietly. おお is
// a prefix, じん the -ian suffix, にん the people-counter: real readings, drilled,
// but never uttered standing alone. `isBoundReading` flags them and the row wears
// a muted "in compounds" tag, so showing the reading does not tell the learner
// they can pronounce 大 as おお by itself. The CEJC-leading row is never marked;
// the tag exists to clarify the additional compound-bound rows.
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
import {
  legacyUnqualifiedReading,
  readingDefinitions,
  wordUnitFacts,
  type VocabRow,
} from "@/data/vocab";
import { isBoundReading, wordTypeOf } from "@/lib/lesson-roles";
import { wordFormKind } from "@/lib/word-forms";
import type { Standing } from "@/lib/library/standing";
import type { FactId } from "@/types";

// The Library shows how each reading is going right beside the reading; the
// lesson teach view does not (it is teaching, not grading). So the standing is
// an OPTIONAL lookup the caller supplies. When absent the panel renders no chips.
export interface CounterSense {
  /** The reading to show and speak — いっぽん, or the glyph itself for a kana
   * form (ひとつ). */
  readonly reading: string;
  /** A second reading the same number branches into — く beside きゅう (9). Shown
   * after the primary reading, but the speaker stays on the primary. Empty for a
   * form with one reading. */
  readonly altReading?: string;
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
 * only) the standing of any scored fact. A word builds one per definition/read
 * relationship; a counter builds a single one. */
interface SenseRow {
  reb: string;
  /** A second reading of the same number, shown after the primary (く after
   * きゅう). Empty when the form has one reading. The speaker stays on the
   * primary reading. */
  altReb?: string;
  kind: string;
  /** The muted "in compounds" tag on an additional bound reading (おお, じん,
   * にん). The CEJC-leading row is never marked. */
  bound: boolean;
  /** CEJC-backed, definition-scoped preference. It never compares readings
   * belonging to different meanings. */
  preferred: boolean;
  /** The downstep to draw the pitch overline at, or null for no verified pitch. */
  pitch: number | null;
  readingStanding: Standing | null;
  meaningStanding: Standing | null;
}

interface SenseGroup {
  meaning: string;
  rows: readonly SenseRow[];
}

/** The ONE shape every word and counter uses: a Reading | Kind | Means table.
 * A single-reading word (or a counter) is a one-row table, so every page reads
 * the same whether it has one reading or several. */
function SenseTable({
  title,
  groups,
  voiceName,
  transparent,
}: {
  title: string;
  groups: readonly SenseGroup[];
  voiceName: string;
  /** Flat look on the Library entry page — drops the panel's frosty fill. */
  transparent: boolean;
}) {
  return (
    <LessonPanel title={title} transparent={transparent}>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium text-text-muted">
              <th className="py-1.5 pr-2 font-medium">Reading</th>
              <th className="py-1.5 pr-2 font-medium">Kind</th>
              <th className="py-1.5 font-medium">Means</th>
            </tr>
          </thead>
          {groups.map((group, groupIndex) => (
            <tbody key={groupIndex} className="border-b border-border last:border-b-0">
              {group.rows.map((r, readingIndex) => (
              <tr key={readingIndex}>
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
                    {/* A second reading the same number branches into — く beside
                        きゅう. It reads "also …" so it is plainly a reading, not a
                        meaning; the speaker above stays on the primary. */}
                    {r.altReb ? (
                      <span className="font-kana text-[13px] text-text-muted">
                        also {r.altReb}
                      </span>
                    ) : null}
                    {r.readingStanding ? (
                      <StandingChip standing={r.readingStanding} />
                    ) : null}
                  </span>
                  {r.preferred ? (
                    <span className="mt-1 block text-[11px] leading-snug text-accent">
                      Usually preferred in everyday conversation
                    </span>
                  ) : null}
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
                {readingIndex === 0 ? (
                <td
                  rowSpan={group.rows.length}
                  className="py-2 align-middle text-text"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{group.meaning}</span>
                    {r.meaningStanding ? (
                      <StandingChip standing={r.meaningStanding} />
                    ) : null}
                  </span>
                </td>
                ) : null}
              </tr>
              ))}
            </tbody>
          ))}
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
  showReferenceReadings = false,
}: {
  word?: VocabRow;
  voiceName: string;
  standings?: (factId: FactId) => Standing | null;
  counter?: CounterSense;
  /** Library-only: show exceptionally uncommon valid readings separately. */
  showReferenceReadings?: boolean;
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
      altReb: counter.altReading,
      kind: counter.kind,
      bound: false,
      preferred: false,
      pitch: null,
      readingStanding: counter.readingStanding,
      meaningStanding: counter.meaningStanding,
    };
    return (
      <SenseTable
        title="How you say it, and what it means"
        groups={[{ meaning: counter.meaning, rows: [row] }]}
        voiceName={voiceName}
        transparent={transparent}
      />
    );
  }

  // Every other caller drives the panel from a VocabRow. The optional-`word`
  // signature exists only so the counter branch above can omit it; a word caller
  // always passes one, so this guard never fires for them.
  if (!word) return null;

  const definitions = readingDefinitions(word);

  // Facts remain keyed by READING, while presentation is definition-first and
  // may reorder readings inside a definition. Join by reb rather than position,
  // so a CEJC display sort cannot move a standing chip onto another fact. The
  // reading fact is null for a kana word, which mints no reading question.
  const unitFacts = standings ? wordUnitFacts(word.keb) : null;
  const standingFor = (id: FactId | null | undefined): Standing | null =>
    id && standings ? standings(id) : null;

  // The pitch artifact was validated against the frozen vocabulary reading.
  // CEJC may select another primary, so keep the accent on the pronunciation it
  // was actually verified for instead of transferring it with display order.
  const pitch = wordPitch(word.keb);
  const pitchReading = legacyUnqualifiedReading(word.keb);

  // A conjugating word names its paradigm in the Kind column — う-verb, る-verb,
  // い-/な-adjective, irregular verb — the same class badge the lesson's role tag
  // shows, so "verb" is never the whole answer when a finer one exists. It is a
  // property of the WORD, not a single reading, so every row carries it; a
  // non-conjugating word (a noun) falls back to the reading-unit's plain type.
  const formKind = wordFormKind(word);
  const factsByReading = new Map(unitFacts?.map((facts) => [facts.unit.reb, facts]) ?? []);
  const groupsFor = (key: "readings" | "referenceReadings"): SenseGroup[] =>
    definitions.flatMap((definition) => {
      const selected = definition[key];
      if (!selected.length) return [];
      return [{
        meaning: definition.glosses.slice(0, 4).join(", "),
        rows: selected.map((sense) => {
          const facts = factsByReading.get(sense.reb);
          return {
            reb: sense.reb,
            kind: formKind ?? wordTypeOf(sense),
            bound: sense.reb !== word.reb && isBoundReading(sense),
            preferred: definition.preferredReading === sense.reb,
            pitch: pitch != null && sense.reb === pitchReading ? pitch : null,
            readingStanding: standingFor(facts?.reading),
            meaningStanding: standingFor(facts?.meaning),
          };
        }),
      }];
    });
  const groups = groupsFor("readings");
  const referenceGroups = groupsFor("referenceReadings");

  return (
    <>
      <SenseTable
        title="How you say it, and what it means"
        groups={groups}
        voiceName={voiceName}
        transparent={transparent}
      />
      {showReferenceReadings && referenceGroups.length ? (
        <div className="mt-3.5">
          <SenseTable
            title="Other dictionary readings"
            groups={referenceGroups}
            voiceName={voiceName}
            transparent={transparent}
          />
        </div>
      ) : null}
    </>
  );
}
