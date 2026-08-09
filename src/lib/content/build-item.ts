// buildItem — assemble a ContentItem from an entry, by READING the existing
// registries, not by re-deriving anything.
//
// This is the Stage-1 keystone: an item's `facts` come from `factsOf(entry)`
// (facts.ts), each classified by `jp2enResponse` (ask-forms.ts), and its `roles`
// from `characterRoles` (character-role.ts). So "a number is a word with all its
// facts" is true BY CONSTRUCTION — teach a number as its word entry (word:三,
// which carries さん AND "three") and its reading can no longer be dropped, the
// way the counters track used to when it taught the kanji entry + a hand-picked
// meaning fact.
//
// The `kind` is passed in: the track that orders items knows each item's kind, so
// buildItem need not re-classify subjects. `prereqs` are the item's direct DAG
// edges, derived from the same sources the Built-from card uses (see below).

import { factsOf, factInfo } from "@/lib/facts";
import { jp2enResponse } from "@/lib/ask-forms";
import { characterRoles } from "@/lib/character-role";
import { teachableParts } from "@/lib/kanji-parts";
import { builtPieceEntryId } from "@/lib/library/entries";
import { kanjiEntry } from "@/data/kanji";
import type { EntryId } from "@/types";
import type { ContentItem, ContentKind } from "./item";
import type { Fact } from "./fact";

const HAN = /\p{Script=Han}/u;

/**
 * An item's DIRECT prerequisites — one level of the DAG. The scheduler follows
 * them transitively and depth-gates, so this returns only the immediate edges:
 *   - a kanji needs its meaningful component pieces (the same `builtPieces` the
 *     Built-from card shows, via `teachableParts` → `builtPieceEntryId`);
 *   - a word / number / counter needs the kanji it is written with;
 *   - kana has none, and a generative-rule unit's prereqs are supplied by its
 *     own track (not derivable from a glyph), so both return [].
 * A single-char word points at its own kanji entry — a known redundancy to
 * revisit when the kanji/word two-entry split is reconciled.
 */
function directPrereqs(kind: ContentKind, glyph: string): EntryId[] {
  const out = new Set<EntryId>();
  if (kind === "kanji") {
    for (const p of teachableParts(glyph) ?? []) out.add(builtPieceEntryId(p.c));
  } else if (kind === "word" || kind === "number" || kind === "counter") {
    for (const ch of glyph) if (HAN.test(ch)) out.add(kanjiEntry(ch));
  }
  return [...out];
}

/**
 * Build the ContentItem for `entry`, or undefined if the entry has no facts (so a
 * caller can't mint an item for something the registry has no record of). Every
 * field is derived from existing sources — facts, roles, and the prereq edges.
 */
export function buildItem(entry: EntryId, kind: ContentKind): ContentItem | undefined {
  const factIds = factsOf(entry);
  if (!factIds.length) return undefined;
  const glyph = factInfo(factIds[0])!.glyph;
  const facts: Fact[] = factIds.map((id) => ({ id, kind: jp2enResponse(id) }));
  const roles = characterRoles(glyph);
  return { entry, kind, glyph, facts, roles, prereqs: directPrereqs(kind, glyph) };
}
