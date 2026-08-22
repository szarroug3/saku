// The complete view-model for CharacterEntryView.
//
// This intentionally lives on the LIVE content side: it reads the same source
// registries the view historically read and is the single derivation called by
// both the lesson/dev live path and scripts/seed-content-entries.mjs. Library
// detail pages deserialize its exact output instead of rebuilding it in the
// browser (which would pull the curriculum dictionary into their bundle).

import { etymologyOf, phoneticReading } from "@/data/kanji-etymology";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { radicalByGlyph, radicalVariants } from "@/data/radicals";
import { vocabRow, wordSenseRegister } from "@/data/vocab";
import { exampleFor, type WordExample } from "@/data/word-examples";
import { itemHeadline, type Headline } from "@/lib/content/headline";
import type { ContentItem } from "@/lib/content/item";
import { strokeFallbackOf } from "@/lib/lesson-roles";
import { teachableParts } from "@/lib/kanji-parts";
import { usedAsPartIn } from "@/lib/library/components";
import { builtPieceEntryId, readingsOf } from "@/lib/library/entries";
import { piecesOf, type WordPiece } from "@/lib/library/word-pieces";
import type { PrecomputedStrokeFallback } from "@/components/lesson/how-its-written";
import type { EntryId } from "@/types";

interface CharacterPart {
  readonly glyph: string;
  readonly entry: EntryId;
  readonly sense: string;
  readonly role: string | null;
}

interface CharacterReadingGroup {
  readonly label: string;
  readonly help: string;
  readonly readings: readonly { readonly base: string; readonly example: string }[];
}

interface CharacterVariant {
  readonly glyph: string;
  readonly position: string;
  readonly example: { readonly glyph: string; readonly entry: EntryId } | null;
}

export interface CharacterWordMeaning {
  /** That sense's glosses, joined. */
  readonly text: string;
  /** JMdict register/formality tags for THIS sense only (SAK-32), most to
   * least formal. Never promoted to the reading or the word: a word card can
   * show one sense tagged and a sibling sense untagged. Empty when the sense
   * carries none of the five in-scope tags. */
  readonly register: readonly string[];
}

export interface CharacterWordReading {
  readonly reading: string;
  /** One entry per distinct sense. */
  readonly meanings: readonly CharacterWordMeaning[];
}

interface CharacterWordPiece {
  readonly written: string;
  readonly char: string;
  readonly reading: string;
  readonly entry: EntryId;
  readonly meaning: string;
}

interface CharacterUsedIn {
  readonly glyph: string;
  readonly entry: EntryId;
  readonly meaning: string;
}

/** JSON-safe, display-ready output for every source CharacterEntryView reads. */
export interface CharacterEntryPayload {
  readonly item: ContentItem;
  readonly headline: Headline;
  readonly parts: readonly CharacterPart[];
  readonly story: string | null;
  readonly groups: readonly CharacterReadingGroup[];
  readonly variants: readonly CharacterVariant[];
  readonly wordRows: readonly CharacterWordReading[];
  readonly wordPieces: readonly CharacterWordPiece[];
  readonly example: WordExample | null;
  readonly kanjiMeaning: string | null;
  readonly radicalMeaning: string | null;
  readonly usedIn: readonly CharacterUsedIn[];
  readonly strokeFallback: PrecomputedStrokeFallback;
}

const POSITION: Record<string, { en: string; rank: number }> = {
  "": { en: "normal", rank: 0 },
  kanmuri: { en: "top", rank: 1 },
  hen: { en: "left", rank: 2 },
  tsukuri: { en: "right", rank: 3 },
  ashi: { en: "bottom", rank: 4 },
  nyou: { en: "bottom-left", rank: 5 },
};

function derivePosition(nameKana: string): { en: string; rank: number } {
  if (nameKana.startsWith("した")) return POSITION.ashi;
  if (nameKana.includes("がしら") || nameKana.includes("かんむり")) return POSITION.kanmuri;
  return POSITION[""];
}

function positionOf(v: {
  position?: { readonly romaji: string; readonly kana: string };
  name: { readonly kana: string };
}): { en: string; rank: number } {
  if (v.position) return POSITION[v.position.romaji] ?? { en: v.position.kana, rank: 6 };
  return derivePosition(v.name.kana);
}

/**
 * The exact live derivation CharacterEntryView renders. Seed code calls this
 * function too; no part of the fetched payload is independently reimplemented.
 */
export function characterEntryPayload(item: ContentItem): CharacterEntryPayload {
  const glyph = item.glyph;
  const single = [...glyph].length === 1;
  const isKanji = item.roles.includes("kanji");
  const isRadical = item.roles.includes("radical");
  const isWord = item.roles.includes("word") || item.kind === "word";

  const etymology = isKanji ? etymologyOf(glyph) : null;
  const parts: CharacterPart[] = isKanji
    ? etymology && etymology.components.length > 0
      ? etymology.components.map((c) => ({
          glyph: c.glyph,
          entry: builtPieceEntryId(c.glyph),
          // A phonetic component's raw crawled `sense` is empty (SAK-137) — it
          // was chosen for its SOUND, not a meaning, so there is nothing there
          // to show. Show the reading it actually lends instead (never
          // invented — phoneticReading only returns an on-reading the app's
          // own data already confirms the host shares), same "phonetic" role
          // tag either way. Falls back to the bare tag, no invented text, when
          // no shared on-reading exists (see phoneticReading's own doc).
          sense:
            c.function === "phonetic"
              ? (() => {
                  const reading = phoneticReading(glyph, c.glyph);
                  return reading ? `lends ${reading}` : "";
                })()
              : (c.sense ?? ""),
          role: c.function ?? null,
        }))
      : (teachableParts(glyph) ?? []).map((p) => ({
          glyph: p.c,
          entry: builtPieceEntryId(p.c),
          sense: p.meaning,
          role: null,
        }))
    : [];

  const groups: CharacterReadingGroup[] = [];
  if (isKanji) {
    const readings = readingsOf(glyph);
    for (const [type, label, help] of [
      [
        "on",
        "On’yomi",
        "A reading borrowed from Chinese, usually taken when several kanji link into a compound word.",
      ],
      [
        "kun",
        "Kun’yomi",
        "The native Japanese reading, usually taken when the kanji stands alone or with a hiragana tail.",
      ],
    ] as const) {
      const selected = readings
        .filter((r) => r.type === type || r.type === "both")
        .map((r) => ({ base: r.base, example: r.anchor }));
      if (selected.length > 0) groups.push({ label, help, readings: selected });
    }
  }

  const variants = isRadical
    ? radicalVariants(glyph)
        .map((v) => ({
          glyph: v.glyph,
          position: positionOf(v).en,
          rank: positionOf(v).rank,
          example: usedAsPartIn(v.glyph)[0] ?? null,
        }))
        .sort((a, b) => a.rank - b.rank)
        .map(({ glyph: variantGlyph, position, example }) => ({
          glyph: variantGlyph,
          position,
          example: example ? { glyph: example, entry: kanjiEntry(example) } : null,
        }))
    : [];

  const wordRows: CharacterWordReading[] = [];
  const word = isWord ? vocabRow(glyph) : undefined;
  if (word) {
    const byReading = new Map<string, CharacterWordMeaning[]>();
    for (const sense of word.senses) {
      byReading.set(sense.reb, [
        ...(byReading.get(sense.reb) ?? []),
        {
          text: sense.glosses.join(", "),
          register: wordSenseRegister(word.keb, sense.reb, sense.glosses),
        },
      ]);
    }
    if (byReading.size === 0) {
      byReading.set(word.reb, [
        {
          text: word.glosses.join(", "),
          register: wordSenseRegister(word.keb, word.reb, word.glosses),
        },
      ]);
    }
    for (const [reading, meanings] of byReading) wordRows.push({ reading, meanings });
  }

  const wordPieces: CharacterWordPiece[] =
    word && !single
      ? (piecesOf(word) ?? [])
          .filter(
            (p): p is Extract<WordPiece, { kind: "kanji" }> & { entry: EntryId } =>
              p.kind === "kanji" && p.entry !== null,
          )
          .map((p) => ({
            written: p.written,
            char: p.char,
            reading: p.reading,
            entry: p.entry,
            meaning: kanjiRow(p.char)?.meanings.slice(0, 2).join(", ") ?? "",
          }))
      : [];

  const usedIn = usedAsPartIn(glyph).map((c) => ({
    glyph: c,
    entry: kanjiEntry(c),
    meaning: kanjiRow(c)?.meanings.slice(0, 2).join(", ") ?? "",
  }));

  const strokeItem = {
    entry: item.entry,
    glyph,
    kind: isKanji ? "kanji" : "radical",
    facts: item.facts.map((f) => f.id),
  } as Parameters<typeof strokeFallbackOf>[0];

  return {
    item,
    headline: itemHeadline(item),
    parts,
    story: etymology?.originText ?? null,
    groups,
    variants,
    wordRows,
    wordPieces,
    example: isWord ? exampleFor(glyph) : null,
    kanjiMeaning: isKanji ? (kanjiRow(glyph)?.meanings.join(", ") ?? null) : null,
    radicalMeaning: isRadical ? (radicalByGlyph(glyph)?.meaning ?? null) : null,
    usedIn,
    strokeFallback: {
      normal: strokeFallbackOf(strokeItem, false),
      reference: strokeFallbackOf(strokeItem, true),
    },
  };
}
