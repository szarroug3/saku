// KEIGO track — the ContentItems and KeigoFormUnits of the honorific/humble sets.
//
// A keigo SET (src/data/keigo.ts) is one entry carrying several recognition
// facts — one per polite word in the set (召し上がる, いただく, …). `buildItem`
// already turns that entry into a valid ContentItem (its facts ARE in the
// registry), so this file only enumerates the distinct set entries and reads the
// keigo data back off each item to fill the KeigoFormUnit's display fields.

import { buildItem } from "./build-item.ts";
import { KEIGO_FACTS, keigoSetForEntry, keigoWordInfo } from "@/data/keigo";
import { wordEntry } from "@/data/vocab";
import type { ContentItem } from "./item.ts";
import type { KeigoFormUnit } from "./teach-unit.ts";

/** The distinct keigo SET entries, each as a ContentItem via `buildItem`. One
 * item per set (its facts are the set's polite words). The display glyph is
 * anchored on the BASE verb the set replaces (食べる), not a polite form — the
 * Learn card shows the plain word the learner already knows, and the page then
 * teaches all the set's polite forms. Undefined builds are skipped.
 *
 * GATED ON ITS PLAIN VERB. A set means nothing until you know the everyday word
 * it replaces, so its item is `blockedBy` that verb — the scheduler holds the set
 * back until the verb is learned vocabulary, and a set the curriculum never
 * teaches the verb for never surfaces. `buildItem` leaves blockedBy empty, so the
 * gate is set HERE. The gate is the set's PRIMARY plain verb (data order): the set
 * truly opens on ANY of its plain verbs, which the all-of `blockedBy` can't
 * express, and the primary is the closest single-verb stand-in. The formulaic
 * greeting (いらっしゃいませ) has no plain verb, so it stays ungated. */
export function keigoItems(): ContentItem[] {
  const seen = new Set<string>();
  const items: ContentItem[] = [];
  for (const f of KEIGO_FACTS) {
    if (seen.has(f.entry as string)) continue;
    seen.add(f.entry as string);
    const item = buildItem(f.entry, "keigo");
    if (!item) continue;
    const base = keigoSetForEntry(item.entry)?.plain[0]?.keb;
    items.push({
      ...item,
      ...(base ? { glyph: base } : {}),
      blockedBy: base ? [wordEntry(base)] : [],
    });
  }
  return items;
}

/**
 * The KeigoFormUnit of a keigo item — one unit per SET. `base` is the plain verb
 * the set replaces (食べる); `form`/`register` describe the set's primary polite
 * word (its first fact) as the headline. The whole set is taught on one page, so
 * `cost` is the number of polite FORMS the set carries — honorific + humble is 2,
 * a set with two humbles and one honorific is 3. `base` defaults to "" for a set
 * with no plain verb (the formulaic いらっしゃいませ); `register` defaults to
 * "polite" only if the data somehow carries no register.
 */
export function keigoUnitsOf(item: ContentItem): KeigoFormUnit[] {
  const set = keigoSetForEntry(item.entry);
  const primary = item.facts[0] ? keigoWordInfo(item.facts[0].id) : undefined;
  return [
    {
      kind: "keigo-form" as const,
      item,
      base: set?.plain[0]?.keb ?? "",
      form: primary?.word.word ?? item.glyph,
      register: primary?.word.register ?? "polite",
      facts: item.facts.map((f) => f.id),
      cost: set ? set.words.length : Math.max(1, item.facts.length),
    },
  ];
}
