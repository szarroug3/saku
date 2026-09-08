// The complete view-model for CharacterEntryView.
//
// This intentionally lives on the LIVE content side: it reads the same source
// registries the view historically read and is the single derivation called by
// both the lesson/dev live path and scripts/seed-content-entries.mjs. Library
// detail pages deserialize its exact output instead of rebuilding it in the
// browser (which would pull the curriculum dictionary into their bundle).

import { builtPieces, etymologyOf } from "@/data/kanji-etymology";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { radicalByGlyph, radicalVariants } from "@/data/radicals";
import { radicalTipFor } from "@/data/radical-tips";
import { readingUnits, vocabRow, wordSenseRegister, wordUnitFacts } from "@/data/vocab";
import { exampleFor, type WordExample } from "@/data/word-examples";
import { wordContrastNoteFor } from "@/data/word-contrast-notes";
import { itemHeadline, type Headline } from "@/lib/content/headline";
import type { ContentItem } from "@/lib/content/item";
import { isFactFresh } from "@/lib/content/unit-scheduler-core";
import { strokeFallbackOf, type StrokeFallback } from "@/lib/lesson-roles";
import { teachablePieceMeaning } from "@/lib/kanji-parts";
import { usedAsPartIn } from "@/lib/library/components";
import { builtPieceEntryId, readingsOf } from "@/lib/library/entries";
import { piecesOf, type WordPiece } from "@/lib/library/word-pieces";
// The bushu-position fallback moved to the route layer with SAK-398; this
// module is build-time code now and reads it from there.
import { derivePosition, POSITION } from "@/app/(sky)/radical-position";
import type { EntryId, HistoryFile } from "@/types";

/** Both of `strokeFallbackOf`'s answers for one glyph (normal + reference
 * mode), precomputed — see scripts/build-library-index.mjs's `strokeFallback`.
 * Declared here since SAK-398, when the shared renderer that used to own it
 * went with src/components; this is its only reader now. */
export interface PrecomputedStrokeFallback {
  readonly normal: StrokeFallback;
  readonly reference: StrokeFallback;
}

interface CharacterPart {
  readonly glyph: string;
  readonly entry: EntryId;
  readonly sense: string;
  readonly role: string | null;
}

interface CharacterReadingGroup {
  readonly label: string;
  readonly help: string;
  /**
   * SAK-265: `example` is null for a FALLBACK row — a reading KANJIDIC2
   * documents but that no taught everyday word's kana aligns to, so there is no
   * real anchor word to show or ask about (see KanjiRow.on/.kun). Never invent
   * a placeholder here; the view renders the row without an "as in ..." clause
   * instead.
   */
  readonly readings: readonly { readonly base: string; readonly example: string | null }[];
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
  /**
   * SAK-150: whether this reading is one `readingUnits` actually mints a
   * scored fact for — the same reading the drill can be quizzed on, not
   * merely a JMdict sense variant this row's glosses were sourced from. A
   * multi-reading word (七: しち AND なな, both real spoken forms) can have
   * MORE than one taught row; `lesson` mode below filters to exactly these,
   * so the teach screen never shows a pronunciation the quiz can never ask
   * about, and never teaches one while silently also scheduling a sibling the
   * screen never displayed.
   */
  readonly taught: boolean;
  /**
   * SAK-157: whether this TAUGHT reading is the one actually being freshly
   * introduced right now, as opposed to a sibling reading of the same word
   * that was taught in some earlier lesson and is merely being re-displayed
   * because the word re-entered a lesson step for its OTHER, genuinely-new
   * reading (七 taught しち long ago; this lesson introduces なな — しち must
   * not print again as if it were new). Computed via `isFactFresh` (the same
   * "no record at all" test the scheduler itself uses to decide dueness) when
   * `characterEntryPayload` is given a `history`; otherwise mirrors `taught`,
   * which is the correct behaviour for every caller that has no learner
   * history to check against (the Library route's cached, history-independent
   * payload, and /dev/views) — see `characterEntryPayload`'s own doc.
   */
  readonly fresh: boolean;
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
  /** SAK-155: a single radical's own hand-authored recognition tip (勹 wraps
   * around another radical almost every time) — how to SPOT its role inside a
   * kanji, not a lookalike contrast (those go through `confusables`/`tip` on
   * the ConfusionSection rows instead, see radical-tips.ts's own header for
   * why the two are different mechanisms). Null when the radical has none
   * authored, which is most of the 214 — absence is normal, not an error. */
  readonly radicalTip: string | null;
  /** SAK-229: a hand-authored note distinguishing this word from another word
   * that glosses the same in English (いいえ vs いや, both "no") — see
   * word-contrast-notes.ts's own header for why this exists and what it is
   * NOT. Null when this word has no authored partner, which is nearly every
   * word — absence is normal, not an error. */
  readonly wordNote: string | null;
  readonly usedIn: readonly CharacterUsedIn[];
  readonly strokeFallback: PrecomputedStrokeFallback;
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
 *
 * `history` is OPTIONAL and, when given, is read for exactly one thing: each
 * word row's `fresh` flag (SAK-157) — whether ITS OWN reading-unit fact(s) are
 * still `isFactFresh`, the identical test the lesson scheduler
 * (unit-scheduler-core.ts) already used to decide the word's UNIT is due. A
 * multi-reading word can be due because only ONE of its readings is new; this
 * is what lets the lesson-mode filter in CharacterEntryView show that reading
 * alone instead of every reading the word has ever taught. Omitted by the
 * Library route's cached, history-independent payload (scripts/seed-content-
 * entries.mjs) and by /dev/views, both of which have no live learner history
 * to check — `fresh` mirrors `taught` in that case, which is a no-op for
 * lesson-mode filtering (see CharacterEntryView) and irrelevant to every other
 * caller, which never reads `fresh` at all.
 */
export function characterEntryPayload(
  item: ContentItem,
  history?: HistoryFile,
): CharacterEntryPayload {
  const glyph = item.glyph;
  const single = [...glyph].length === 1;
  const isKanji = item.roles.includes("kanji");
  const isRadical = item.roles.includes("radical");
  const isWord = item.roles.includes("word") || item.kind === "word";

  const etymology = isKanji ? etymologyOf(glyph) : null;
  // SAK-224: the Sub-components list is `builtPieces` — THE join between the
  // shapes a kanji is actually DRAWN from (KanjiVG's `comps`) and Wiktionary's
  // glyph origin — not the raw etymology components this used to read.
  //
  // The raw components are Wiktionary's CANONICAL characters (人, 水, 肉), which
  // is not what the character on the page is drawn with: 仁/仏/仕 are written
  // with 亻, 河 with 氵, 肝 with the flesh 月. Reading them raw printed the
  // canonical form for 882 of the 2,136 kanji (41%) — a learner looking at 仁
  // was told it contains 人 and got no hint that the shape they must recognise
  // and write is 亻. It also printed the pieces `builtPieces` deliberately
  // DROPS: structural `form` shells, and pieces Wiktionary names but that the
  // drawn shape does not carry (服's 月 is a corruption of 舟 and matches
  // neither of its components — labelling it "flesh" is the exact dishonesty
  // the etymology layer refuses). And it missed the pieces `builtPieces` ADDS:
  // its repeated-container expansion (森 → 木·木·木) and its hand-verified
  // overrides (二 → 一·一).
  //
  // `builtPieces` is already the source of truth everywhere else this question
  // is asked — `teachableParts` (the lesson's prerequisite graph and the drill
  // hints) reads it, and `lessonRoles` gates this very section on it — so the
  // page now agrees with the lesson instead of contradicting it.
  const parts: CharacterPart[] = isKanji
    ? builtPieces(glyph).map((p) => ({
        glyph: p.glyph,
        entry: builtPieceEntryId(p.glyph),
        // A phonetic piece's label is the on-reading it lends (never invented —
        // `phoneticReading`, inside builtPieces, only returns a reading the
        // app's own data already confirms the host shares); a semantic piece's
        // is the contextual sense Wiktionary gives. Where a semantic piece has
        // no contextual sense (河's 氵), fall back to the piece's OWN meaning
        // from our own tables — "water" — rather than printing a bare role tag.
        // Empty string only when there is genuinely nothing honest to say.
        sense:
          p.role === "phonetic"
            ? p.label
              ? `lends ${p.label}`
              : ""
            : (p.label ?? teachablePieceMeaning(p.glyph) ?? ""),
        role: p.role,
      }))
    : [];

  const groups: CharacterReadingGroup[] = [];
  if (isKanji) {
    const readings = readingsOf(glyph);
    // SAK-265: raw KANJIDIC2 readings, read ONLY as a fallback for a type the
    // aligned data below has nothing for — see KanjiRow.on/.kun. 114 of 2,136
    // jouyou kanji (壱, 藩, 栃, 陛, ...) have no taught everyday word whose kana
    // aligns to them at all, so `readings` is empty for every type; many more
    // have real evidence for one type (on OR kun) but not the other. Either way
    // the section must not go blank when KANJIDIC2 itself documents an answer.
    const raw = kanjiRow(glyph);
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
      const selected: { readonly base: string; readonly example: string | null }[] = readings
        .filter((r) => r.type === type || r.type === "both")
        .map((r) => ({ base: r.base, example: r.anchor }));
      if (selected.length === 0 && raw) {
        // No taught word attests this type at all: fall back to KANJIDIC2's own
        // list for it, unattested (no anchor word exists to show or ask about).
        for (const base of type === "on" ? raw.on : raw.kun) {
          selected.push({ base, example: null });
        }
      }
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
    // SAK-150: the readings `readingUnits` actually mints a scored fact for —
    // the ONE authoritative enumeration `wordUnitFacts`/`buildVocabFacts` and
    // the curriculum walk (curriculum-lesson.ts's factsOf) already read. A
    // `byReading` row not in this set is a reference-tier or unscored sense
    // variant: real for the Library's full dictionary view, but never
    // something the drill can ask about, so `lesson` mode must not teach it
    // either. `readingUnits` wants a `VocabRow`, which `word` already is.
    //
    // Empty `taughtRebs` (the defensive `byReading.size === 0` branch just
    // above, or any other edge `readingUnits` declines to score) means "no
    // scoring signal available" rather than "nothing is taught" — treated as
    // taught so a row this page would otherwise print is never silently
    // dropped from the lesson for a reason that has nothing to do with SAK-150.
    const taughtRebs = new Set(readingUnits(word).map((u) => u.reb));
    // SAK-157: per-reading fact ids (reading fact + meaning fact), so `fresh`
    // can ask the SAME `isFactFresh` the scheduler used to decide this word's
    // unit was due — never re-derived or guessed, just read off the one
    // enumeration (`wordUnitFacts`) that mints these ids in the first place.
    const factsByReb = new Map(wordUnitFacts(word.keb).map((u) => [u.unit.reb, u]));
    for (const [reading, meanings] of byReading) {
      const taught = taughtRebs.size === 0 || taughtRebs.has(reading);
      const unitFacts = factsByReb.get(reading);
      const fresh = !history
        ? taught
        : taught &&
          (!unitFacts ||
            (unitFacts.reading ? isFactFresh(unitFacts.reading, history) : false) ||
            isFactFresh(unitFacts.meaning, history));
      wordRows.push({ reading, meanings, taught, fresh });
    }
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
    radicalTip: isRadical ? (radicalTipFor(glyph) ?? null) : null,
    wordNote: isWord ? (wordContrastNoteFor(glyph) ?? null) : null,
    usedIn,
    strokeFallback: {
      normal: strokeFallbackOf(strokeItem, false),
      reference: strokeFallbackOf(strokeItem, true),
    },
  };
}
