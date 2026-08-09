// buildGlyphItem / buildItem — assemble a ContentItem by READING the existing
// registries, not by re-deriving anything.
//
// A CHARACTER (single Han glyph) is ONE cohesive item across every role it plays:
// its facts are the UNION of `factsOf` over its radical / kanji / word entries
// (whichever `characterRoles` reports), so 三 carries the kanji "three", its
// readings, AND the number word さん in a single item — never split into a kanji
// item and a number item that teach 三 twice. This mirrors the words/kanji
// curriculum spine (curriculum-lesson.ts), where a glyph is one item with a roles
// set; `buildGlyphItem` is that same aggregation for the content model.
//
// A WORD (multi-char), a COUNTER form, and a generative-rule unit are single-entry
// and use `buildItem(entry, kind)`.

import { factsOf, factInfo } from "@/lib/facts";
import { jp2enResponse } from "@/lib/ask-forms";
import { characterRoles } from "@/lib/character-role";
import { teachableParts } from "@/lib/kanji-parts";
import { builtPieceEntryId } from "@/lib/library/entries";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { radicalEntry, radicalByGlyph } from "@/data/radicals";
import { wordEntry } from "@/data/vocab";
import type { EntryId } from "@/types";
import type { ContentItem, ContentKind } from "./item";
import type { Fact } from "./fact";

const HAN = /\p{Script=Han}/u;

/** The Built-from component edges of a glyph — the same pieces the Built-from card
 * shows (`teachableParts` → `builtPieceEntryId`), deduped. */
function componentPrereqs(glyph: string): EntryId[] {
  const out = new Set<EntryId>();
  for (const p of teachableParts(glyph) ?? []) out.add(builtPieceEntryId(p.c));
  return [...out];
}

/** The canonical entry that identifies a glyph's cohesive item, mirroring
 * `builtPieceEntryId`'s precedence (kanji > radical > word) so a prerequisite
 * edge pointing at the glyph resolves to this same item. */
function canonicalEntry(glyph: string): EntryId {
  if (kanjiRow(glyph)) return kanjiEntry(glyph);
  if (radicalByGlyph(glyph) !== undefined) return radicalEntry(glyph);
  return wordEntry(glyph);
}

/** The facts of an entry, each classified by direction (definition/romaji). */
function factsFrom(entry: EntryId): Fact[] {
  return factsOf(entry).map((id) => ({ id, kind: jp2enResponse(id) }));
}

/**
 * A single Han glyph as ONE cohesive `character` item: the union of its roles'
 * facts, its roles, and its Built-from prereq edges. Undefined if the glyph plays
 * no role or has no facts (so a caller can't mint a hollow item).
 */
export function buildGlyphItem(glyph: string): ContentItem | undefined {
  const roles = characterRoles(glyph);
  if (!roles.length) return undefined;
  const facts: Fact[] = [];
  if (roles.includes("radical")) facts.push(...factsFrom(radicalEntry(glyph)));
  if (roles.includes("kanji")) facts.push(...factsFrom(kanjiEntry(glyph)));
  if (roles.includes("word")) facts.push(...factsFrom(wordEntry(glyph)));
  if (!facts.length) return undefined;
  return {
    entry: canonicalEntry(glyph),
    kind: "character",
    glyph,
    facts,
    roles,
    prereqs: componentPrereqs(glyph),
  };
}

/**
 * The DIRECT prerequisites of a non-character item — a multi-char word or a
 * counter form needs the kanji (cohesive character items) it is written with.
 * Kana and generative-rule units have none.
 */
function directPrereqs(kind: ContentKind, glyph: string): EntryId[] {
  const out = new Set<EntryId>();
  if (kind === "word" || kind === "counter") {
    for (const ch of glyph) if (HAN.test(ch)) out.add(kanjiEntry(ch));
  }
  return [...out];
}

/**
 * Build the ContentItem for a single-entry `entry` (a multi-char word, a counter
 * form, a generative-rule unit), or undefined if it has no facts. Characters go
 * through `buildGlyphItem` instead — do not pass "character" here.
 */
export function buildItem(entry: EntryId, kind: ContentKind): ContentItem | undefined {
  const factIds = factsOf(entry);
  if (!factIds.length) return undefined;
  const glyph = factInfo(factIds[0])!.glyph;
  const facts: Fact[] = factIds.map((id) => ({ id, kind: jp2enResponse(id) }));
  const roles = characterRoles(glyph);
  return { entry, kind, glyph, facts, roles, prereqs: directPrereqs(kind, glyph) };
}
