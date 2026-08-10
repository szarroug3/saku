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
import { wordReadingUnit, readingFrequency } from "@/data/vocab";
import { canonicalMeaningId } from "./meaning";
import { buildGlyphItem } from "./build-item";
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
export interface TeachingUnitBase {
  readonly kind: TeachingUnitKind;
  /** The content this unit teaches from — for Library dedup (first-unit-per-item)
   * and to link a unit back to its full page. */
  readonly item: ContentItem;
  /** What it teaches — history/SRS keyed on these fact ids. Never empty. */
  readonly facts: readonly FactId[];
  /** How much to learn, in the owner's model (computed per-type). Budgeted by the scheduler. */
  readonly cost: number;
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
    default:
      return []; // keigo · grammar · transitivity · sentence-ordering · generative-rule — not yet built
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

// ── PRONUNCIATION-track ordering (CEJC frequency — a pronunciation-only notion) ──
/** How often this unit's pronunciation is spoken (CEJC). The pronunciation track
 * orders by this; other tracks order their own way. */
export function unitFrequency(unit: PronunciationUnit): number {
  return unit.reading ? readingFrequency(unit.glyph, unit.reading) : 0;
}

/** Pronunciation units most-spoken first — 人 → ひと (6580), にん (1270), じん (389). */
export function byFrequencyDesc(a: PronunciationUnit, b: PronunciationUnit): number {
  return unitFrequency(b) - unitFrequency(a);
}

/** The pronunciation curriculum sequence: every glyph's pronunciation units,
 * frequency-ordered across the set. (Dueness, prereqs, and budget layer on top.) */
export function orderedUnits(glyphs: Iterable<string>): PronunciationUnit[] {
  const units: PronunciationUnit[] = [];
  for (const glyph of glyphs) {
    const item = buildGlyphItem(glyph);
    if (item) units.push(...pronunciationUnitsOf(item));
  }
  return units.sort(byFrequencyDesc);
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
