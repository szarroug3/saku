// TEACHING UNIT — a unit of TEACHING (a skill), polymorphic over what is taught.
//
// A `ContentItem` is CONTENT — a noun (kana, kanji, word, keigo set, grammar
// pattern, verb pair, sentence pattern). A `TeachingUnit` is a SKILL a lesson
// teaches FROM it, and the mapping is per-type: a word yields PRONUNCIATION units,
// a sentence pattern yields SENTENCE-BUILD units (the rule, not the sentence),
// grammar yields PRODUCTION units. Content we don't teach directly yields none.
//
// The scheduler is uniform over the BASE contract (`kind`, `item`, `facts`,
// `cost`) — it never cares which implementation a unit is. Each per-type impl adds
// its own display data; a `Track` orders its own units (frequency for the
// pronunciation track, curriculum sequence for grammar, …).

import { factInfo } from "@/lib/facts";
import { wordReadingUnit, readingFrequency, wordEntry } from "@/data/vocab";
import { canonicalMeaningId } from "./meaning";
import { buildGlyphItem, buildItem } from "./build-item";
import { kanaUnitsOf } from "./kana-unit";
import { generativeUnitsOf } from "./numbers-track";
import { keigoUnitsOf } from "./keigo-unit";
import { grammarUnitsOf } from "./grammar-unit";
import { verbPairUnitsOf } from "./verb-pair-unit";
import { sentenceBuildUnitsOf } from "./sentence-track";
import { isFactFresh } from "./scheduler";
import type { EntryId, FactId, HistoryFile } from "@/types";
import type { MeaningId } from "./meaning";
import type { ContentItem } from "./item";

export type TeachingUnitKind =
  | "pronunciation"
  | "keigo-form"
  | "grammar-production"
  | "verb-pair"
  | "sentence-build"
  | "generative-rule";

/** The common contract of every teachable skill — all the scheduler and Library
 * ever touch. Per-type implementations extend it with their own display data. */
/**
 * How a track's units fill a lesson:
 *   - "cost"  — the default: pack units toward the LessonRange budget by `cost`
 *     (five-ish readings/meanings a sitting). Kana, vocab, keigo, grammar, …
 *   - "unit"  — one unit IS a whole lesson, never budgeted with others: a
 *     sentence-ordering tier is a full sitting of assembly drills on its own.
 */
export type SchedulingMode = "cost" | "unit";

export interface TeachingUnitBase {
  readonly kind: TeachingUnitKind;
  /** The content this unit teaches from — for Library dedup (first-unit-per-item)
   * and to link a unit back to its full page. */
  readonly item: ContentItem;
  /** What it teaches — history/SRS keyed on these fact ids. Never empty. */
  readonly facts: readonly FactId[];
  /** How much to learn, in the owner's model (computed per-type). Budgeted by the scheduler. */
  readonly cost: number;
  /** How the scheduler places this unit in a lesson. Omitted = "cost" (budgeted);
   * "unit" makes it a lesson on its own. Uniform within a track. */
  readonly scheduling?: SchedulingMode;
}

export interface UnitMeaning {
  readonly id: MeaningId;
  readonly label: string;
}

/** PRONUNCIATION — teach a pronunciation of a glyph/word and the meaning(s) read
 * that way. (character / word / counter / number.) */
export interface PronunciationUnit extends TeachingUnitBase {
  readonly kind: "pronunciation";
  readonly glyph: string; // = item.glyph
  /** The pronunciation taught (kana), or null for a meaning-only unit. */
  readonly reading: string | null;
  readonly meanings: readonly UnitMeaning[];
}

/** KEIGO — teach a polite form of a verb. (to be built by the keigo track.) */
export interface KeigoFormUnit extends TeachingUnitBase {
  readonly kind: "keigo-form";
  readonly base: string; // the plain verb the polite form is of
  readonly form: string; // the polite form taught
  readonly register: string; // honorific / humble / polite
}

/** GRAMMAR — teach how to produce a grammar form. */
export interface GrammarProductionUnit extends TeachingUnitBase {
  readonly kind: "grammar-production";
  readonly pattern: string; // 〜たい
  readonly summary: string; // what it does
}

/** TRANSITIVITY — teach an intransitive/transitive verb pair. */
export interface VerbPairUnit extends TeachingUnitBase {
  readonly kind: "verb-pair";
  readonly intransitive: string; // 開く
  readonly transitive: string; // 開ける
  readonly base: string; // the kanji both verbs share (開); "" when they share none (生まれる/産む)
}

/** SENTENCE ORDERING — teach how to BUILD a sentence: the rule, not the sentence. */
export interface SentenceBuildUnit extends TeachingUnitBase {
  readonly kind: "sentence-build";
  readonly rule: string;
  readonly example: string;
}

/** NUMBERS/COUNTERS — teach a generative range/counter rule ("read 11-99"). */
export interface GenerativeRuleUnit extends TeachingUnitBase {
  readonly kind: "generative-rule";
  readonly label: string;
}

export type TeachingUnit =
  | PronunciationUnit
  | KeigoFormUnit
  | GrammarProductionUnit
  | VerbPairUnit
  | SentenceBuildUnit
  | GenerativeRuleUnit;

// ── PRONUNCIATION builder ────────────────────────────────────────────────────
/**
 * The pronunciation units of a glyph item — one per reading. Word facts group by
 * their reading (`wordReadingUnit`); a kanji/radical core meaning (no reading)
 * attaches to the primary pronunciation, or forms a reading-null unit when the
 * glyph is taught with no word. Merged glosses show as synonyms; cost = meanings.
 */
export function pronunciationUnitsOf(item: ContentItem): PronunciationUnit[] {
  const rebOf = (id: FactId): string | null => wordReadingUnit(id)?.unit.reb ?? null;
  const primaryReb =
    item.facts.map((f) => rebOf(f.id)).find((r): r is string => r != null) ?? null;

  const order: (string | null)[] = [];
  const groups = new Map<
    string | null,
    { meanings: Map<MeaningId, Set<string>>; facts: FactId[] }
  >();
  for (const f of item.facts) {
    const key = rebOf(f.id) ?? primaryReb;
    let group = groups.get(key);
    if (!group) {
      group = { meanings: new Map(), facts: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.facts.push(f.id);
    if (f.kind === "definition") {
      const gloss = factInfo(f.id)?.meaning;
      if (gloss) {
        const id = canonicalMeaningId(f.id, gloss);
        let glosses = group.meanings.get(id);
        if (!glosses) {
          glosses = new Set();
          group.meanings.set(id, glosses);
        }
        glosses.add(gloss);
      }
    }
  }
  return order.map((reading) => {
    const group = groups.get(reading)!;
    const meanings = [...group.meanings].map(([id, glosses]) => {
      const canonical = String(id);
      const synonyms = [...glosses].filter((g) => g !== canonical);
      return { id, label: [canonical, ...synonyms].join(", ") };
    });
    return {
      kind: "pronunciation" as const,
      item,
      glyph: item.glyph,
      reading,
      meanings,
      facts: group.facts,
      cost: meanings.length, // one per distinct meaning; the reading is shared
    };
  });
}

/**
 * DISPATCH — the teaching units OF a content item, by its kind. A word/character/
 * counter yields pronunciation units; the keigo/grammar/transitivity/sentence
 * tracks add their own builders here as they land; content we don't teach directly
 * yields none.
 */
export function teachUnitsOf(item: ContentItem): readonly TeachingUnit[] {
  switch (item.kind) {
    case "character":
    case "word":
    case "counter":
      return pronunciationUnitsOf(item);
    case "kana":
      return kanaUnitsOf(item);
    case "generative-rule":
      return generativeUnitsOf(item);
    case "keigo":
      return keigoUnitsOf(item);
    case "grammar":
      return grammarUnitsOf(item);
    case "transitivity":
      return verbPairUnitsOf(item);
    case "sentence-ordering":
      return sentenceBuildUnitsOf(item);
  }
}

/** A unit's learning cost — its per-type field. The scheduler budgets by this. */
export function unitCost(unit: TeachingUnit): number {
  return unit.cost;
}

/** A unit is DUE (not yet learned) when any of its facts is still fresh. */
export function isUnitDue(unit: TeachingUnit, history: HistoryFile): boolean {
  return unit.facts.some((id) => isFactFresh(id, history));
}

// ── PRONUNCIATION-track ordering ────────────────────────────────────────────
/** How often this unit's pronunciation is spoken (CEJC). Used to pick a
 * glyph's PRIMARY reading (unit-scheduler.ts's `primaryUnit`, for prereq
 * resolution) and by the raw-frequency helpers just below. The live VOCAB
 * track itself no longer orders by this — see `curriculumOrderedUnits`. */
export function unitFrequency(unit: PronunciationUnit): number {
  return unit.reading ? readingFrequency(unit.glyph, unit.reading) : 0;
}

/** Pronunciation units most-spoken first — 人 → ひと (6580), にん (1270), じん (389). */
export function byFrequencyDesc(a: PronunciationUnit, b: PronunciationUnit): number {
  return unitFrequency(b) - unitFrequency(a);
}

/** A glyph's own `character` (single Han) or `word` (kana/multi-char) item —
 * the fallback every pronunciation-unit builder below needs.
 *
 * `buildGlyphItem` is single-Han-character only (it aggregates a glyph's
 * radical/kanji/word ROLES, which only a single character plays — see
 * `characterRoles`). A multi-character glyph plays no such role and always
 * answers undefined, so it falls back to `buildItem(wordEntry(glyph), "word")`
 * — the same word-builder the app already uses for a multi-character word's
 * own entry-detail page. Without this fallback, every multi-character word in
 * `CURRICULUM_SEQUENCE` (6,906 of 9,140 glyphs) silently produced zero
 * teaching units and could never be scheduled — see
 * docs/interleaved-schedule-findings.md. */
function glyphItem(glyph: string): ContentItem | undefined {
  return buildGlyphItem(glyph) ?? buildItem(wordEntry(glyph), "word");
}

/**
 * Every pronunciation unit of an arbitrary glyph set, RAW-FREQUENCY ordered —
 * a general-purpose helper (test fixtures, ad hoc glyph lists), NOT the live
 * vocab track's own order any more. SAK-173: that used to be `unit-tracks.ts`'s
 * `vocabUnits()`, and it was a bug — a global resort by raw CEJC frequency that
 * threw away CURRICULUM_SEQUENCE's prerequisite-aware, per-pronunciation-
 * frequency-interleaved order (SAK-162) entirely, so the live lesson and the
 * Library's own ranking disagreed about what came next. `curriculumOrderedUnits`
 * below is what `vocabUnits()` calls today. */
export function orderedUnits(glyphs: Iterable<string>): PronunciationUnit[] {
  const units: PronunciationUnit[] = [];
  for (const glyph of glyphs) {
    const item = glyphItem(glyph);
    if (item) units.push(...pronunciationUnitsOf(item));
  }
  return units.sort(byFrequencyDesc);
}

/** One (glyph, reading) position in an external spine — the minimal shape
 * `curriculumOrderedUnits` needs off a `CurriculumItem` (curriculum-order.ts /
 * curriculum-sequence.ts), kept local so this module doesn't have to import
 * either. */
export interface GlyphReadingPosition {
  readonly glyph: string;
  /** The position's specific pronunciation (a word-role item), or null for a
   * radical/kanji-only item — see curriculum-order.ts's header, "ONE ITEM PER
   * GLYPH — EXCEPT A WORD". */
  readonly reading: string | null;
}

/**
 * The VOCAB track's real order (SAK-173): pronunciation units built in EXACTLY
 * `sequence`'s own order — no frequency re-sort. `sequence` is
 * CURRICULUM_SEQUENCE (or its frozen twin, curriculum-sequence.ts) — the
 * prerequisite-aware order that already carries SAK-162's per-pronunciation-
 * frequency interleave, one entry per (glyph, reading): a glyph with N
 * teachable readings occupies N separate entries, each naming which reading it
 * is; a radical/kanji-only glyph occupies exactly one, with `reading: null`.
 *
 * A glyph's full pronunciation-unit set (`pronunciationUnitsOf` — one unit per
 * reading it has any facts for, or a single null-reading unit for a glyph with
 * no word role) is built once and cached; every `sequence` entry for that
 * glyph — its first (radical/kanji-only, or a folded/standalone word's PRIMARY
 * reading) and every later entry for one of its OTHER readings — looks up its
 * own `reading` out of that cached set and emits it once, at its own position.
 * Nothing is re-sorted and nothing is deduped away first: `sequence`'s repeats
 * are the point, not a hazard the old `new Set(...)` wrapper around
 * `orderedUnits` had to guard against.
 *
 * A `sequence` entry whose (glyph, reading) matches no built unit is skipped,
 * not thrown — the same "an item that claims a role needs something to read
 * from, and an honest miss beats a crash" posture curriculum-order.ts's own
 * `pushGlyph` takes.
 */
export function curriculumOrderedUnits(
  sequence: readonly GlyphReadingPosition[],
): PronunciationUnit[] {
  const cache = new Map<string, readonly PronunciationUnit[]>();
  const out: PronunciationUnit[] = [];
  for (const { glyph, reading } of sequence) {
    let units = cache.get(glyph);
    if (units === undefined) {
      const item = glyphItem(glyph);
      units = item ? pronunciationUnitsOf(item) : [];
      cache.set(glyph, units);
    }
    const unit = units.find((u) => u.reading === reading);
    if (unit) out.push(unit);
  }
  return out;
}

/**
 * The Library sequence: teaching order, deduped to each item's FIRST unit. A word
 * appears ONCE, at its first (most-frequent) pronunciation's position; later units
 * of the same item are skipped. The entry links to the full item page.
 */
export function libraryOrder(teachingOrder: readonly TeachingUnit[]): ContentItem[] {
  const seen = new Set<EntryId>();
  const out: ContentItem[] = [];
  for (const unit of teachingOrder) {
    if (seen.has(unit.item.entry)) continue;
    seen.add(unit.item.entry);
    out.push(unit.item);
  }
  return out;
}

/** One lesson's worth of teaching units, in teach order (prereqs first). */
export interface UnitLesson {
  readonly units: readonly TeachingUnit[];
}

/** A concrete word that shows a unit's pronunciation in use — 人/にん → 三人. */
export interface UnitExample {
  readonly word: string;
  readonly gloss: string | null;
}
