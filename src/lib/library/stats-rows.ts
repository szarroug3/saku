// Progress's "By subject" rows: one StatsSubject per scheduled subject, Words
// split into words/numbers/counters and Kana into hiragana/katakana, grouped
// as the page shows them. Static for every visitor, computed once per process.
//
// Its own module (SAK-399): the Sky's home reads these rows for its discovery
// panel and legend, and used to import all of server-lookups.ts to get them,
// 1,392 lines of the old app's /learn and /library actions and, through one of
// them, a lesson React component. server-lookups.ts re-exports getStatsRows so
// the client's action name for it still resolves.

import { KANA_SUBJECT } from "@/data/characters";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";
import { counterForm, isBareNumber } from "@/data/counters";
import { KANJI_SUBJECT } from "@/data/kanji";
import { numberConstructionEntry } from "@/data/number-construction-id";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { ALL_FACTS, entryOf, factInfo } from "@/lib/facts";
import { factType } from "@/lib/practice-types";
import type { EntryId, FactId } from "@/types";

/* -------------------------------------------------------------------------
 * STATS PAGE (Progress's "By subject") — SAK-104. by-subject.tsx's module
 * scope used to walk ALL_FACTS via factInfo/entryOf (facts.ts, guarded) to
 * build one Subject per scheduled subject, split Words into
 * words/numbers/counters (factType, counterForm/isBareNumber — data/
 * counters.ts, itself guarded via facts.ts) and Kana into hiragana/katakana,
 * then grouped the result into the page's Vocabulary/Counting/Kana rows. None
 * of that depends on the reader's own history — it's the identical static
 * walk for every visitor — so it moves here as one action, computed once and
 * cached for the server process's lifetime (same pattern as SHELF_CACHE
 * above). The client keeps only what DOES depend on the reader: met counts,
 * standing, and the row labels (SUBJECT_LABEL, a plain string table with no
 * guarded dependency of its own — see by-subject.tsx). ------------------- */

export interface StatsSubject {
  readonly id: string;
  readonly facts: readonly FactId[];
  readonly entries: readonly EntryId[];
  /** entry -> its facts, within this subject's own population only — built
   * once per Subject (top-level or a split-off child, Hiragana/Numbers/…)
   * rather than read from one shared registry keyed by top-level subject id.
   * A plain object (not a Map) so it survives the Server Action boundary the
   * same way every other batched action here returns its rows. */
  readonly entryFacts: Readonly<Record<string, readonly FactId[]>>;
}

export type StatsRow =
  | { kind: "subject"; subject: StatsSubject }
  | { kind: "group"; label: string; children: StatsSubject[] };

export interface StatsData {
  rows: StatsRow[];
  /** SENTENCE_ORDERING_TIERS.length — the one other piece of the page's
   * module-scope data that reached a guarded module (data/assembly.ts, via
   * its own factInfo import), needed only as a count. */
  sentenceTierCount: number;
}

function buildStatsSubject(id: string, facts: FactId[]): StatsSubject {
  const entryFacts: Record<string, FactId[]> = {};
  const entries: EntryId[] = [];
  for (const f of facts) {
    const e = entryOf(f) as unknown as string;
    const list = entryFacts[e];
    if (list) list.push(f);
    else {
      entryFacts[e] = [f];
      entries.push(e as unknown as EntryId);
    }
  }
  return { id, facts, entries, entryFacts };
}

/** The two bare-number generative categories ("Numbers 1-99", "Numbers
 * 100-9999") — the only construction categories with no counter attached.
 * Every other category is a real counter. See by-subject.tsx's original
 * comment (git history) for the full reasoning; unchanged by this move. */
const NUMBER_CATEGORY_ENTRIES: ReadonlySet<EntryId> = new Set([
  numberConstructionEntry("tens"),
  numberConstructionEntry("big"),
]);

function isCountingNumberEntry(entry: EntryId): boolean {
  if (NUMBER_CATEGORY_ENTRIES.has(entry)) return true;
  const form = counterForm(entry);
  return form !== undefined && isBareNumber(form);
}

// Not exported: this is a "use server" file, and Next only allows async
// function exports from one (a plain const export would break the build).
// by-subject.tsx's SUBJECT_LABEL duplicates these same 4 literal ids.
const COUNTING_NUMBERS_ID = "counting-numbers";
const COUNTING_COUNTERS_ID = "counting-counters";
const KANA_HIRAGANA_ID = "kana-hiragana";
const KANA_KATAKANA_ID = "kana-katakana";

function splitWordSubject(
  subject: StatsSubject,
): { words: StatsSubject; numbers: StatsSubject; counters: StatsSubject } {
  const wordFacts: FactId[] = [];
  const numberFacts: FactId[] = [];
  const counterFacts: FactId[] = [];
  for (const f of subject.facts) {
    if (factType(f) !== "counter") {
      wordFacts.push(f);
      continue;
    }
    (isCountingNumberEntry(entryOf(f)) ? numberFacts : counterFacts).push(f);
  }
  return {
    words: buildStatsSubject(subject.id, wordFacts),
    numbers: buildStatsSubject(COUNTING_NUMBERS_ID, numberFacts),
    counters: buildStatsSubject(COUNTING_COUNTERS_ID, counterFacts),
  };
}

function splitKanaSubject(
  subject: StatsSubject,
): { hiragana: StatsSubject; katakana: StatsSubject } {
  const hiraganaFacts = subject.facts.filter((f) => factType(f) === "hiragana");
  const katakanaFacts = subject.facts.filter((f) => factType(f) === "katakana");
  return {
    hiragana: buildStatsSubject(KANA_HIRAGANA_ID, hiraganaFacts),
    katakana: buildStatsSubject(KANA_KATAKANA_ID, katakanaFacts),
  };
}

const VOCABULARY_CHILD_IDS: readonly string[] = [RADICAL_SUBJECT, KANJI_SUBJECT, VOCAB_SUBJECT];

let STATS_DATA_CACHE: StatsData | null = null;

/** Every row Progress's "By subject" table renders, in display order — see
 * this section's header for why this can be computed once and cached rather
 * than per-request. */
export async function getStatsRows(): Promise<StatsData> {
  if (STATS_DATA_CACHE) return STATS_DATA_CACHE;

  const byId = new Map<string, FactId[]>();
  const order: string[] = [];
  for (const f of ALL_FACTS) {
    const id = factInfo(f)?.subject;
    if (!id) continue;
    let list = byId.get(id);
    if (!list) {
      list = [];
      byId.set(id, list);
      order.push(id);
    }
    list.push(f);
  }
  const subjects = order.map((id) => buildStatsSubject(id, byId.get(id)!));

  const rows: StatsRow[] = [];
  let vocabularyChildren: StatsSubject[] | null = null;
  for (const s of subjects) {
    if (s.id === KANA_SUBJECT) {
      const { hiragana, katakana } = splitKanaSubject(s);
      rows.push({ kind: "group", label: "Kana", children: [hiragana, katakana] });
      continue;
    }
    if (s.id === VOCAB_SUBJECT) {
      const { words, numbers, counters } = splitWordSubject(s);
      if (!vocabularyChildren) {
        vocabularyChildren = [];
        rows.push({ kind: "group", label: "Vocabulary", children: vocabularyChildren });
      }
      vocabularyChildren.push(words);
      rows.push({ kind: "group", label: "Counting", children: [numbers, counters] });
      continue;
    }
    if (VOCABULARY_CHILD_IDS.includes(s.id)) {
      if (!vocabularyChildren) {
        vocabularyChildren = [];
        rows.push({ kind: "group", label: "Vocabulary", children: vocabularyChildren });
      }
      vocabularyChildren.push(s);
      continue;
    }
    rows.push({ kind: "subject", subject: s });
  }

  STATS_DATA_CACHE = { rows, sentenceTierCount: SENTENCE_ORDERING_TIERS.length };
  return STATS_DATA_CACHE;
}
