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
import { TERM_SUBJECT, TERMS, termEntry } from "@/data/terms";
import { MARK_SUBJECT } from "@/data/marks";
import { GRAMMAR_CONCEPT_SUBJECT, grammarConceptEntry, grammarConceptFor } from "@/data/grammar-concepts";
import { radicalConfusableTip } from "@/data/radical-tips";
import { wordContrastPartner } from "@/data/word-contrast-notes";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { VOCAB, VOCAB_SUBJECT, vocabRow } from "@/data/vocab";
import { currentUserId } from "@/lib/auth";
import { emptyHistory } from "@/lib/history-ops";
import { loadHistory } from "@/lib/history";
import { knownWordsUsing, usedAsPartIn } from "@/lib/library/components";
import { confusableWith, COUNTER_KIND, entryForGlyph, libEntry, LIB_ENTRIES_BY_KIND, SENTENCE_RULE_KIND, type Kind, type LibEntry } from "@/lib/library/entries";
import { quizzableFacts } from "@/lib/library/reading-proof-facts";
import { searchByType } from "@/lib/library/search";
import { shelfSections } from "@/lib/library/shelf-sections";
import type { RelatedGroup } from "@/sky/components/lesson-card";
import type { AtlasEntry, AtlasSearchResult, AtlasSection, AtlasShelf, SkyAtlasData } from "@/sky/components/sky-atlas";
import type { CoverageCounts } from "@/sky/lib/coverage";
import type { SkyItem, SkyKind } from "@/sky/lib/types";
import type { EntryId, HistoryFile } from "@/types";

import { standingFor } from "./learner";
import { conceptTwin, teachFor } from "./teach";
import { offerings, pickFacts, TSU_RULE, type Offerings } from "./observatory";

/** The shelves, in the order the app teaches the subjects. Every cut of
 * every shelf is shown (Sam's call, 2026-09-05: everything, without having
 * to search); the page mounts a cut's tiles only as it comes into view. */
const SHELVES: ReadonlyArray<{ id: string; kinds: readonly Kind[]; sky: SkyKind; title: string; unit: string }> = [
  { id: "kana", kinds: [KANA_SUBJECT], sky: "kana", title: "Kana", unit: "kana" },
  { id: "radicals", kinds: [RADICAL_SUBJECT], sky: "radical", title: "Radicals", unit: "radicals" },
  { id: "kanji", kinds: [KANJI_SUBJECT], sky: "kanji", title: "Kanji", unit: "kanji" },
  { id: "words", kinds: [VOCAB_SUBJECT], sky: "word", title: "Words", unit: "words" },
  { id: "counting", kinds: [COUNTER_KIND], sky: "counter", title: "Counting", unit: "counters" },
  { id: "grammar", kinds: [GRAMMAR_SUBJECT], sky: "grammar", title: "Grammar", unit: "patterns" },
  { id: "sentences", kinds: [SENTENCE_RULE_KIND], sky: "sentence", title: "Sentences", unit: "sentence rules" },
  { id: "verb-pairs", kinds: [TRANSITIVITY_SUBJECT], sky: "verbPair", title: "Verb pairs", unit: "verb pairs" },
  { id: "keigo", kinds: [KEIGO_SUBJECT], sky: "keigo", title: "Keigo", unit: "keigo sets" },
  // the writing rules and the grammar concepts are terms too (Sam,
  // 2026-09-05): one shelf of pages to read, in the app's three cuts
  { id: "terms", kinds: [TERM_SUBJECT, MARK_SUBJECT, GRAMMAR_CONCEPT_SUBJECT], sky: "term", title: "Terms", unit: "terms" },
];

/** How many of a related group are listed; the note carries the whole count. */
const RELATED_SHOWN = 12;
const SEARCH_PER_KIND = 24;

/** A writing rule or a grammar concept that a term already names (Dakuten,
 * Keigo): the term's page carries it, so it is not shown twice. */
const termNamed = (name: string | undefined) => !!name && TERMS.some((t) => t.name.toLowerCase() === name.toLowerCase());
const twinned = (e: LibEntry): boolean => (e.kind === MARK_SUBJECT || e.kind === GRAMMAR_CONCEPT_SUBJECT) && termNamed(e.name);
const all = (kind: Kind): readonly LibEntry[] => (LIB_ENTRIES_BY_KIND.get(kind) ?? []).filter((e) => !twinned(e));

/** The page to read about a grammar concept: the term of that name when
 * there is one (Keigo), else the concept itself. */
const readAbout = (conceptId: string): EntryId => {
  const name = grammarConceptFor(grammarConceptEntry(conceptId))?.name;
  const term = name ? TERMS.find((t) => t.name.toLowerCase() === name.toLowerCase()) : undefined;
  return term ? termEntry(term.id) : grammarConceptEntry(conceptId);
};

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
    const entries = shelf.kinds.flatMap(all);
    const sections: AtlasSection[] = [];
    // a shelf of several kinds (Terms) is one cut, in the kinds' order
    const cuts = shelf.kinds.length > 1
      ? [{ id: shelf.id, label: shelf.title, entries: shelf.kinds.flatMap((kind) => shelfSections(kind, "everyday").flatMap((c) => c.entries)) }]
      : shelfSections(shelf.kinds[0], "everyday");
    for (const cut of cuts) {
      // the native numbers are one rule, the 〜つ tile, first among the
      // counting rules (Sam, 2026-09-05), with the ten forms under it
      if (cut.id === "counters-tsu") continue;
      const rules = cut.id === "counters-constructions";
      const ids = [...(rules ? [TSU_RULE] : []), ...cut.entries.filter((e) => !twinned(e)).map((e) => o.offerPick(e.id)?.id).filter((id): id is string => !!id)];
      if (ids.length) sections.push({ id: cut.id, label: rules ? "Counting rules" : cut.label, items: ids });
    }
    const onShelf = sections.reduce((n, s) => n + s.items.length, 0);
    shown.push(...sections.flatMap((s) => s.items));
    return { id: shelf.id, kind: shelf.sky, title: shelf.title, unit: shelf.unit, total: entries.length, counts: countsOver(entries, history, now), sections, more: Math.max(0, entries.length - onShelf) };
  }).filter((s) => s.total > 0);
  const holds = ([VOCAB_SUBJECT, KANJI_SUBJECT, KANA_SUBJECT] as const).map((kind) => ({ total: all(kind).length, unit: SHELVES.find((s) => s.kinds.includes(kind))!.unit }));
  // the tiles need only what a tile shows, plus how much a quiz could ask
  // (so the panel's buttons are right the moment it opens); an entry's
  // parts come with it when it is opened
  const lean = (id: string): SkyItem | undefined => {
    const it = o.items.get(id);
    if (!it) return undefined;
    const { components: _parts, ...rest } = it;
    return { ...rest, quizzable: quizzableFacts(pickFacts([id]), history).length };
  };
  return { items: shown.map(lean).filter((x): x is SkyItem => !!x), shelves, holds };
}

/** The app's search, by kind, as Atlas sections. */
export function atlasSearchFromHistory(history: HistoryFile, query: string, now = Date.now()): AtlasSearchResult {
  const o = offerings(history, now);
  // a section per shelf, keyed by the shelf's id so the page can match them
  const sections: AtlasSection[] = [];
  for (const s of searchByType(query, { perSection: SEARCH_PER_KIND })) {
    const shelf = SHELVES.find((sh) => sh.kinds.includes(s.kind));
    const items = s.hits.filter((h) => !twinned(h.entry)).map((h) => o.offerPick(h.entry.id)?.id).filter((id): id is string => !!id);
    if (!items.length) continue;
    // kinds that share a shelf (Terms) share its section
    const have = sections.find((x) => x.id === (shelf?.id ?? s.kind));
    if (have) { have.items = [...have.items, ...items]; if (s.more) have.more = (have.more ?? 0) + s.more; continue; }
    sections.push({ id: shelf?.id ?? s.kind, label: shelf?.title ?? s.label, items, ...(s.more ? { more: s.more } : {}) });
  }
  return { items: closure(o, sections.flatMap((s) => s.items)), sections };
}

/** One entry opened: the card's teaching, and what is related to it both
 * ways, counted against the whole corpus. */
export function atlasEntryFromHistory(history: HistoryFile, id: string, now = Date.now()): AtlasEntry | undefined {
  const o = offerings(history, now);
  // a pick the offerings build themselves (a kana row, the 〜つ rule) has no
  // library entry of its own; it still opens
  const item = o.offerPick(id);
  if (!item) return undefined;
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

  /** The shapes this one is mixed up with, each with its tip where one is
   * written (the app's confusion section): a kana's look-alikes, a kanji's,
   * a radical's partner. */
  const lookalikes = () => {
    const e = libEntry(item.id as EntryId);
    const ids = e ? confusableWith(e) : [];
    const items = ids.slice(0, RELATED_SHOWN).map((x) => o.offerPick(x)).filter((x): x is SkyItem => !!x);
    if (!items.length) return;
    const tips: Record<string, string> = {};
    for (const x of items) { const tip = radicalConfusableTip(glyph, x.glyph); if (tip) tips[x.id] = tip; }
    related.push({ title: "Easily mixed up with", items, early: true, ...(Object.keys(tips).length ? { tips } : {}) });
  };

  if (item.kind === "kana") lookalikes();
  if (item.kind === "kanji") {
    lookalikes();
    // what it is a part of first, then every word written with it, in
    // teaching order, against the whole vocabulary (Sam's order)
    const builds = kanjiIds(usedAsPartIn(glyph));
    if (builds.length) group("Kanji written with it", builds, `You know ${knownOf(builds)} of ${builds.length}`);
    const kebs = VOCAB.filter((w) => w.keb.includes(glyph)).map((w) => w.keb).sort((a, b) => (vocabRow(a)?.beginnerRank ?? Infinity) - (vocabRow(b)?.beginnerRank ?? Infinity));
    const ids = wordIds(kebs);
    if (ids.length) group("Words written with it", ids, `You know ${knownOf(ids)} of ${ids.length}`);
  }
  if (item.kind === "radical") {
    lookalikes();
    const builds = kanjiIds(usedAsPartIn(glyph));
    if (builds.length) group("Kanji written with it", builds, `You know ${knownOf(builds)} of ${builds.length}`);
    const known = wordIds(knownWordsUsing(glyph, history));
    if (known.length) group("Words you know that use it", known, `${known.length}`);
  }
  if (item.kind === "word") {
    // the word it is weighed against (the app's contrast note names both)
    const partner = wordContrastPartner(glyph);
    if (partner) group("Often compared with", wordIds([partner.glyph]));
  }
  if (item.kind === "keigo") {
    // the registers, explained once, as the app's keigo page links out to
    group("Read about it", [readAbout("keigo-registers")]);
  }
  if (item.kind === "term") {
    // a term that carries a concept links where the concept did
    const twin = TERMS.find((x) => termEntry(x.id) === item.id);
    const concept = twin ? conceptTwin(twin.name) : undefined;
    if (concept?.related?.length) group("Read about it", concept.related.map(readAbout));
  }
  if (item.kind === "concept") {
    const concept = grammarConceptFor(item.id as EntryId);
    if (concept?.related?.length) group("Read about it", concept.related.map(readAbout));
  }

  return { id: item.id, items: closure(o, [item.id, ...related.flatMap((g) => g.items.map((x) => x.id))]), teach: teachFor(item), related };
}
