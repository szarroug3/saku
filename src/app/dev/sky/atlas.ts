// The Atlas from the app's tables. Server-side and dev-only, like the
// adapters beside it: the shelves are the Library's own cuts (the kana
// rows, the kanji in teaching order by the hundred, the everyday words),
// the whole size of each collection comes from the library index, the
// learner's standings over all of it from the same standing the sky
// paints, and search and the open entry reach the app's own search and
// tables. Items are built the way the Observatory offers them, so a thing
// looks the same here as it does on every other sky.

import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT } from "@/data/kanji";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { VOCAB, VOCAB_SUBJECT, vocabRow } from "@/data/vocab";
import { currentUserId } from "@/lib/auth";
import { emptyHistory } from "@/lib/history-ops";
import { loadHistory } from "@/lib/history";
import { knownWordsUsing, usedAsPartIn } from "@/lib/library/components";
import { COUNTER_KIND, entryForGlyph, knownFactsOf, libEntry, LIB_ENTRIES_BY_KIND, SENTENCE_RULE_KIND, type Kind, type LibEntry } from "@/lib/library/entries";
import { quizzableFacts } from "@/lib/library/reading-proof-facts";
import { searchByType } from "@/lib/library/search";
import { shelfSections } from "@/lib/library/shelf-sections";
import type { RelatedGroup } from "@/sky/components/lesson-card";
import type { AtlasEntry, AtlasSearchResult, AtlasSection, AtlasShelf, SkyAtlasData } from "@/sky/components/sky-atlas";
import type { CoverageCounts } from "@/sky/lib/coverage";
import type { SkyItem, SkyKind } from "@/sky/lib/types";
import type { EntryId, HistoryFile } from "@/types";

import { standingFor } from "./learner";
import { teachFor } from "./lesson";
import { offerings, type Offerings } from "./observatory";

/** The shelves, in the order the app teaches the subjects. Every cut of
 * every shelf is shown (Sam's call, 2026-09-05: everything, without having
 * to search); the page mounts a cut's tiles only as it comes into view. */
const SHELVES: ReadonlyArray<{ id: string; kind: Kind; sky: SkyKind; title: string; unit: string }> = [
  { id: "kana", kind: KANA_SUBJECT, sky: "kana", title: "Kana", unit: "kana" },
  { id: "radicals", kind: RADICAL_SUBJECT, sky: "radical", title: "Radicals", unit: "radicals" },
  { id: "kanji", kind: KANJI_SUBJECT, sky: "kanji", title: "Kanji", unit: "kanji" },
  { id: "words", kind: VOCAB_SUBJECT, sky: "word", title: "Words", unit: "words" },
  { id: "counting", kind: COUNTER_KIND, sky: "counter", title: "Counting", unit: "counters" },
  { id: "grammar", kind: GRAMMAR_SUBJECT, sky: "grammar", title: "Grammar", unit: "patterns" },
  { id: "sentences", kind: SENTENCE_RULE_KIND, sky: "sentence", title: "Sentences", unit: "sentence rules" },
  { id: "verb-pairs", kind: TRANSITIVITY_SUBJECT, sky: "verbPair", title: "Verb pairs", unit: "verb pairs" },
  { id: "keigo", kind: KEIGO_SUBJECT, sky: "keigo", title: "Keigo", unit: "keigo sets" },
];

/** How many of a related group are listed; the note carries the whole count. */
const RELATED_SHOWN = 12;
const SEARCH_PER_KIND = 24;

const all = (kind: Kind): readonly LibEntry[] => LIB_ENTRIES_BY_KIND.get(kind) ?? [];

/** The learner's standings over a whole collection, for its coverage bar. */
function countsOver(entries: readonly LibEntry[], history: HistoryFile, now: number): CoverageCounts {
  const counts: CoverageCounts = {};
  for (const e of entries) {
    const s = standingFor(e, history, now).standing;
    if (s !== "not-seen") counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

/** The items for some ids with everything under them, from what the
 * offerings built: every part, so their constellations draw whole. */
function closure(o: Offerings, ids: readonly string[]): SkyItem[] {
  const keep = new Map<string, SkyItem>();
  const walk = (id: string) => {
    if (keep.has(id)) return;
    const it = o.items.get(id);
    if (!it) return;
    keep.set(id, it);
    for (const c of it.components ?? []) walk(c);
  };
  ids.forEach(walk);
  return [...keep.values()];
}

/** The signed-in learner's Atlas, or a visitor's. */
export async function learnerAtlas(now = Date.now()): Promise<SkyAtlasData> {
  return atlasFromHistory(await learnerHistory(), now);
}

export async function learnerHistory(): Promise<HistoryFile> {
  const userId = await currentUserId();
  return userId ? await loadHistory(userId) : emptyHistory();
}

export function atlasFromHistory(history: HistoryFile, now = Date.now()): SkyAtlasData {
  const o = offerings(history, now);
  const shown: string[] = [];
  const shelves: AtlasShelf[] = SHELVES.map((shelf) => {
    const entries = all(shelf.kind);
    const sections: AtlasSection[] = [];
    for (const cut of shelfSections(shelf.kind, "everyday")) {
      const ids = cut.entries.map((e) => o.offerPick(e.id)?.id).filter((id): id is string => !!id);
      if (ids.length) sections.push({ id: cut.id, label: cut.label, items: ids });
    }
    const onShelf = sections.reduce((n, s) => n + s.items.length, 0);
    shown.push(...sections.flatMap((s) => s.items));
    return { id: shelf.id, kind: shelf.sky, title: shelf.title, unit: shelf.unit, total: entries.length, counts: countsOver(entries, history, now), sections, more: Math.max(0, entries.length - onShelf) };
  }).filter((s) => s.total > 0);
  const holds = ([VOCAB_SUBJECT, KANJI_SUBJECT, KANA_SUBJECT] as const).map((kind) => ({ total: all(kind).length, unit: SHELVES.find((s) => s.kind === kind)!.unit }));
  // the tiles need only what a tile shows; an entry's parts come with it when it is opened
  const lean = (id: string): SkyItem | undefined => { const it = o.items.get(id); if (!it) return undefined; const { components: _parts, ...rest } = it; return rest; };
  return { items: shown.map(lean).filter((x): x is SkyItem => !!x), shelves, holds };
}

/** The app's search, by kind, as Atlas sections. */
export function atlasSearchFromHistory(history: HistoryFile, query: string, now = Date.now()): AtlasSearchResult {
  const o = offerings(history, now);
  // a section per shelf, keyed by the shelf's id so the page can match them
  const sections: AtlasSection[] = searchByType(query, { perSection: SEARCH_PER_KIND }).map((s) => ({
    id: SHELVES.find((sh) => sh.kind === s.kind)?.id ?? s.kind,
    label: s.label,
    items: s.hits.map((h) => o.offerPick(h.entry.id)?.id).filter((id): id is string => !!id),
    ...(s.more ? { more: s.more } : {}),
  })).filter((s) => s.items.length > 0);
  return { items: closure(o, sections.flatMap((s) => s.items)), sections };
}

/** One entry opened: the card's teaching, and what is related to it both
 * ways, counted against the whole corpus. */
export function atlasEntryFromHistory(history: HistoryFile, id: string, now = Date.now()): AtlasEntry | undefined {
  const o = offerings(history, now);
  const item = o.offerPick(id);
  const entry = libEntry(id as EntryId);
  if (!item || !entry) return undefined;
  const related: RelatedGroup[] = [];
  const glyph = item.glyph;
  /** A group from ids, offering each so it can be drawn and opened. */
  const group = (title: string, ids: readonly string[], note?: string) => {
    const items = ids.slice(0, RELATED_SHOWN).map((x) => o.offerPick(x)).filter((x): x is SkyItem => !!x);
    if (items.length) related.push({ title, items, ...(note ? { note } : {}) });
  };
  const wordIds = (kebs: readonly string[]) => kebs.map((k) => entryForGlyph(VOCAB_SUBJECT, k)).filter((x): x is EntryId => !!x);
  const kanjiIds = (glyphs: readonly string[]) => glyphs.map((g) => entryForGlyph(KANJI_SUBJECT, g)).filter((x): x is EntryId => !!x);
  const knownOf = (ids: readonly string[]) => ids.filter((x) => { const e = libEntry(x as EntryId); return !!e && standingFor(e, history, now).met; }).length;

  if (item.kind === "kanji") {
    // every word written with it, in teaching order, against the whole vocabulary
    const kebs = VOCAB.filter((w) => w.keb.includes(glyph)).map((w) => w.keb).sort((a, b) => (vocabRow(a)?.beginnerRank ?? Infinity) - (vocabRow(b)?.beginnerRank ?? Infinity));
    const ids = wordIds(kebs);
    if (ids.length) group("Words written with it", ids, `you know ${knownOf(ids)} of ${ids.length}`);
    const builds = kanjiIds(usedAsPartIn(glyph));
    if (builds.length) group("Used as a part in", builds, `${builds.length} kanji`);
  }
  if (item.kind === "radical") {
    const builds = kanjiIds(usedAsPartIn(glyph));
    if (builds.length) group("Kanji built from it", builds, `${builds.length} kanji`);
    const known = wordIds(knownWordsUsing(glyph, history));
    if (known.length) group("Words you know that use it", known, `${known.length}`);
  }

  const teach = teachFor(item);
  // how many things a quiz could ask about it: one for a kana, several for a rule
  const quizzable = quizzableFacts(knownFactsOf(entry), history).length;
  return { id: item.id, items: closure(o, [item.id, ...related.flatMap((g) => g.items.map((x) => x.id))]), teach, related, known: standingFor(entry, history, now).met, quizzable };
}
