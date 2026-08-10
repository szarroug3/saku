// KEIGO track — the ContentItems and KeigoFormUnits of the honorific/humble sets.
//
// A keigo SET (src/data/keigo.ts) is one entry carrying several recognition
// facts — one per polite word in the set (召し上がる, いただく, …). `buildItem`
// already turns that entry into a valid ContentItem (its facts ARE in the
// registry), so this file only enumerates the distinct set entries and reads the
// keigo data back off each item to fill the KeigoFormUnit's display fields.

import { buildItem } from "./build-item.ts";
import { KEIGO_FACTS, keigoSetForEntry, keigoWordInfo } from "@/data/keigo";
import type { ContentItem } from "./item.ts";
import type { KeigoFormUnit } from "./teach-unit.ts";

/** The distinct keigo SET entries, each as a ContentItem via `buildItem`. One
 * item per set (its facts are the set's polite words). Undefined builds are
 * skipped. */
export function keigoItems(): ContentItem[] {
  const seen = new Set<string>();
  const items: ContentItem[] = [];
  for (const f of KEIGO_FACTS) {
    if (seen.has(f.entry as string)) continue;
    seen.add(f.entry as string);
    const item = buildItem(f.entry, "keigo");
    if (item) items.push(item);
  }
  return items;
}

/**
 * The KeigoFormUnit of a keigo item — one unit per item. The unit models the
 * item's PRIMARY polite word (its glyph, the first fact's word): `form` is that
 * word, `register` its register from the data (honorific / humble), and `base`
 * the plain verb the set replaces, from the set's `plain` list. `base` defaults
 * to "" for a set with no plain verb (the formulaic いらっしゃいませ); `register`
 * defaults to "polite" only if the data somehow carries no register.
 */
export function keigoUnitsOf(item: ContentItem): KeigoFormUnit[] {
  const set = keigoSetForEntry(item.entry);
  const primary = item.facts[0] ? keigoWordInfo(item.facts[0].id) : undefined;
  return [
    {
      kind: "keigo-form" as const,
      item,
      base: set?.plain[0]?.keb ?? "",
      form: item.glyph,
      register: primary?.word.register ?? "polite",
      facts: item.facts.map((f) => f.id),
      cost: 1,
    },
  ];
}
