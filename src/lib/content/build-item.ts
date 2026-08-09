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
// buildItem need not re-classify subjects. `prereqs` is filled by the next piece
// (wiring the existing prereq walk); it is empty here.

import { factsOf, factInfo } from "@/lib/facts";
import { jp2enResponse } from "@/lib/ask-forms";
import { characterRoles } from "@/lib/character-role";
import type { EntryId } from "@/types";
import type { ContentItem, ContentKind } from "./item";
import type { Fact } from "./fact";

/**
 * Build the ContentItem for `entry`, or undefined if the entry has no facts (so a
 * caller can't mint an item for something the registry has no record of). All
 * fields but `prereqs` are derived from existing sources; `prereqs` is [] until
 * the prereq walk is wired.
 */
export function buildItem(entry: EntryId, kind: ContentKind): ContentItem | undefined {
  const factIds = factsOf(entry);
  if (!factIds.length) return undefined;
  const glyph = factInfo(factIds[0])!.glyph;
  const facts: Fact[] = factIds.map((id) => ({ id, kind: jp2enResponse(id) }));
  const roles = characterRoles(glyph);
  return { entry, kind, glyph, facts, roles, prereqs: [] };
}
