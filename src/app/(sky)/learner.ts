// The learner's sky, from the app's tables and their real history.
//
// Server-side and dev-only for now: this folder is exempt from the Sky
// boundary, and this file is the one adapter between the app's data (the
// Library's entries, the history file, the mix-up records) and the Sky's
// item shape. At cutover it becomes the Sky's data layer. Nothing in
// src/sky knows any of this exists; it gets plain SkyHomeData.
//
// What counts:
//   met       an entry the learner has answered, claimed, or asked to be
//             quizzed on, by any of the facts that define it as known
//   standing  the app's own word for the entry (src/lib/library/standing.ts).
//             An entry with several facts gets the WORST of them, since a
//             star needs one colour and "4 need work" is not a colour; the
//             Library's refusal to pool stands there, this is the sky's rule
//   items     every met entry, plus every part under it (met or not), so a
//             constellation can be drawn whole
//   roots     the met entries that are not part of another met entry

import { KANA_SUBJECT } from "@/data/characters";
import { PRIMITIVE_SUBJECT } from "@/data/components";
import { KANJI_SUBJECT, kanjiRow } from "@/data/kanji";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { currentUserId } from "@/lib/auth";
import { activeWeaknessPairs } from "@/lib/confusions";
import { entryOf } from "@/lib/facts";
import { emptyHistory } from "@/lib/history-ops";
import { loadHistory } from "@/lib/history";
import { entryForGlyph, knownFactsOf, libEntry, LIB_ENTRIES, LIB_ENTRIES_BY_KIND, type LibEntry } from "@/lib/library/entries";
import { KIND_LABEL } from "@/lib/library/kinds";
import { getStatsRows, type StatsData, type StatsSubject } from "@/lib/library/stats-rows";
import { standingOf as appStandingOf, type Standing as AppStanding } from "@/lib/library/standing";
import { learnedSentenceTierIds } from "@/lib/sentence-ordering-learned";
import { buildGraph } from "@/sky/lib/graph";
import type { DiscoveryRow } from "@/sky/components/discovery-panel";
import type { CoverageCounts } from "@/sky/lib/coverage";
import type { MixUp } from "@/sky/components/mix-ups-panel";
import type { SkyHomeData } from "@/sky/components/sky-home";
import { skyRoots } from "@/sky/lib/sky-scene";
import type { Standing } from "@/sky/lib/standing";
import type { SkyItem, SkyKind } from "@/sky/lib/types";
import type { HistoryFile, FactId } from "@/types";

const GRADUATE_RUNS = 10;

/** Worst first: the colour a multi-fact entry's star wears. */
const WORST: readonly AppStanding[] = ["slipping", "shaky", "getting-there", "claimed", "solid", "not-seen"];

const KIND: Partial<Record<string, SkyKind>> = { [KANA_SUBJECT]: "kana", [RADICAL_SUBJECT]: "radical", [PRIMITIVE_SUBJECT]: "radical", [KANJI_SUBJECT]: "kanji", [VOCAB_SUBJECT]: "word" };

/** One fact's standing, the app's reading plus the Sky's one rule: a fact
 * opened in a lesson and not yet asked is "claimed" (shown as untested),
 * since it is in rotation from that moment (Sam, 2026-09-06), not
 * undiscovered until its first quiz. */
export function factStanding(f: FactId, history: HistoryFile, now: number): AppStanding {
  const s = appStandingOf(history.facts[f], history.claims?.[f], now).standing;
  return s === "not-seen" && history.seen?.[f] ? "claimed" : s;
}

/**
 * How an entry is going, and whether it has been met, worked out once per
 * request instead of three times per entry (SAK-382).
 *
 * The Atlas asked for every entry's standing three times over: once for the
 * offerings pass deciding whether the learner has met it, again when that pass
 * built the item, and a third time in each shelf's counts. Over the whole
 * curriculum, with a walk of every fact and date arithmetic on each, that was
 * 737 ms of a 1778 ms response measured on the deployed app. The home does the
 * same over fifteen thousand entries.
 *
 * Held against the history object itself, so it lives exactly as long as the
 * request that read it and can never be shared between two learners. The clock
 * is part of the key because a standing decays with time; a caller that passes
 * a new `now` gets a fresh answer rather than yesterday's. This does assume the
 * history is not mutated while it is being read, which is true of every path
 * here: it is loaded once and written through a separate action.
 */
/**
 * The facts a history has anything on: answered, claimed, or opened in a
 * lesson. Every other fact reads "not-seen" and cannot be met, whatever
 * entry asks, so the pages that used to walk all fifteen thousand entries to
 * find the few hundred that are not "not-seen" walk these instead (SAK-382).
 *
 * The keys, not the values: a key present with a hollow value is a fact the
 * standing code will look at and find nothing on, which is harmless, where
 * a key left out would be a standing never worked out. Per request, held
 * against the history like the standings are.
 */
const touched = new WeakMap<HistoryFile, readonly FactId[]>();
export function touchedFacts(history: HistoryFile): readonly FactId[] {
  let facts = touched.get(history);
  if (!facts) {
    const set = new Set<string>(Object.keys(history.facts ?? {}));
    for (const f of Object.keys(history.claims ?? {})) set.add(f);
    for (const f of Object.keys(history.seen ?? {})) set.add(f);
    facts = [...set] as FactId[];
    touched.set(history, facts);
  }
  return facts;
}

/** Every entry that reads a fact, from `knownFactsOf` turned around over the
 * whole library, once. A merged radical reads its kanji's meaning fact, so
 * that fact has two readers; this is why the map is built from the same
 * function the standings read, not from a fact's own entry id. */
let readers: Map<string, LibEntry[]> | undefined;
function readersOf(fact: FactId): readonly LibEntry[] {
  if (!readers) {
    readers = new Map();
    for (const e of LIB_ENTRIES) for (const f of knownFactsOf(e)) {
      const list = readers.get(f as string);
      if (list) list.push(e); else readers.set(f as string, [e]);
    }
  }
  return readers.get(fact as string) ?? [];
}

/** Whether a history touches few enough facts that walking them beats
 * walking the library: a learner years in has hundreds, the library has
 * fifteen thousand entries. A learner who has touched most of it (a big
 * synthetic one, one day a real one) is walked the old way, over the
 * catalogue and the subjects, which costs the same as it always did. */
export function sparse(history: HistoryFile): boolean {
  return touchedFacts(history).length * 4 < LIB_ENTRIES.length;
}

/** The entries whose standing can be anything but "not-seen", by id: the
 * readers of the touched facts. Per request. */
const touchedByEntry = new WeakMap<HistoryFile, ReadonlyMap<string, LibEntry>>();
export function touchedEntries(history: HistoryFile): ReadonlyMap<string, LibEntry> {
  let map = touchedByEntry.get(history);
  if (!map) {
    const m = new Map<string, LibEntry>();
    for (const f of touchedFacts(history)) for (const e of readersOf(f)) m.set(e.id, e);
    map = m;
    touchedByEntry.set(history, map);
  }
  return map;
}

const standings = new WeakMap<HistoryFile, { now: number; byEntry: Map<string, { standing: Standing; met: boolean }> }>();

export function standingFor(entry: LibEntry, history: HistoryFile, now: number): { standing: Standing; met: boolean } {
  let held = standings.get(history);
  if (!held || held.now !== now) {
    held = { now, byEntry: new Map() };
    standings.set(history, held);
  }
  const known = held.byEntry.get(entry.id);
  if (known) return known;
  const worked = workOutStanding(entry, history, now);
  held.byEntry.set(entry.id, worked);
  return worked;
}

function workOutStanding(entry: LibEntry, history: HistoryFile, now: number): { standing: Standing; met: boolean } {
  const facts = knownFactsOf(entry);
  let met = false;
  let worst: AppStanding = "not-seen";
  let anySeen = false;
  for (const f of facts) {
    const agg = history.facts[f];
    const claimedAt = history.claims?.[f];
    // a fact the history has nothing on is "not-seen" and cannot be met, so
    // the date arithmetic in factStanding is skipped for it (most of the
    // fifteen thousand entries the home walks are like this, SAK-382)
    if (!agg && !claimedAt && !history.seen?.[f]) continue;
    if ((agg?.seen ?? 0) > 0 || claimedAt || history.seen?.[f]) met = true;
    const s = factStanding(f, history, now);
    if (s !== "not-seen") anySeen = true;
    if (WORST.indexOf(s) < WORST.indexOf(worst)) worst = s;
  }
  return { standing: anySeen ? worst : "not-seen", met };
}

/** The entry a component glyph refers to: a kanji, a radical or a primitive. */
export function componentEntry(glyph: string): LibEntry | undefined {
  const id = entryForGlyph(KANJI_SUBJECT, glyph) ?? entryForGlyph(RADICAL_SUBJECT, glyph) ?? entryForGlyph(PRIMITIVE_SUBJECT, glyph);
  return id ? libEntry(id) : undefined;
}

/** The parts an entry is made of, as entries: a word's kanji, a kanji's components. */
export function partsOf(entry: LibEntry): LibEntry[] {
  if (entry.kind === VOCAB_SUBJECT) return [...entry.glyph].map((c) => (kanjiRow(c) ? componentEntry(c) : undefined)).filter((e): e is LibEntry => !!e);
  if (entry.kind === KANJI_SUBJECT) return (kanjiRow(entry.glyph)?.comps ?? []).map(componentEntry).filter((e): e is LibEntry => !!e);
  return [];
}

export function toItem(entry: LibEntry, standing: Standing, parts: readonly LibEntry[]): SkyItem {
  const kind = KIND[entry.kind] ?? "word";
  const english = entry.meanings[0] ?? entry.readings[0] ?? entry.glyph;
  return {
    id: entry.id,
    kind,
    glyph: entry.glyph,
    english,
    reading: kind === "word" || kind === "kanji" ? entry.readings[0] : undefined,
    standing,
    components: parts.length ? parts.map((p) => p.id) : undefined,
  };
}

/** What each subject is called in the discovery panel: the Library's own
 * shelf names, plus the split rows Progress adds. The same table Progress
 * keeps in by-subject.tsx, so the two pages never call one shelf two things. */
const SUBJECT_LABEL: Record<string, string> = {
  ...KIND_LABEL,
  grammar: "Grammar",
  transitivity: "Verb pairs",
  "kana-hiragana": "Hiragana",
  "kana-katakana": "Katakana",
  "counting-numbers": "Numbers",
  "counting-counters": "Counters",
};

/** A subject's entries by the facts they carry in it, turned around from
 * `entryFacts`, once per subject: the way from the touched facts to the
 * subject's entries that could be anything but "not-seen". */
const subjectReaders = new WeakMap<StatsSubject, ReadonlyMap<string, readonly string[]>>();
function touchedInSubject(subject: StatsSubject, history: HistoryFile): ReadonlySet<string> {
  let byFact = subjectReaders.get(subject);
  if (!byFact) {
    const m = new Map<string, string[]>();
    const population = new Set<string>(subject.entries as readonly string[]);
    for (const [e, facts] of Object.entries(subject.entryFacts)) {
      if (!population.has(e)) continue;
      for (const f of facts) { const list = m.get(f as string); if (list) list.push(e); else m.set(f as string, [e]); }
    }
    byFact = m;
    subjectReaders.set(subject, byFact);
  }
  const out = new Set<string>();
  for (const f of touchedFacts(history)) for (const e of byFact.get(f as string) ?? []) out.add(e);
  return out;
}

/** Entries in a subject the learner has met: any of the entry's facts
 * answered, claimed, or opened in a lesson. Only a touched entry can be. */
const metCount = (subject: StatsSubject, history: HistoryFile) =>
  (sparse(history) ? [...touchedInSubject(subject, history)] : (subject.entries as readonly string[]))
    .filter((e) => (subject.entryFacts[e] ?? []).some((f) => history.facts[f]?.seen || history.claims?.[f] || history.seen?.[f])).length;

/** Every entry Progress counts, tallied by standing: the legend's numbers,
 * which add up to the same total as the discovery panel. A multi-fact entry
 * takes the worst of its facts, as a star does; a learned sentence tier is
 * "claimed", the closest word for a completion the model does not score. */
/** The legend's numbers from the discovery rows already worked out: a top
 * row's counts are its subject's, or the sum of its children's, and the
 * Sentences row carries the tiers, so the sum over the top rows is exactly
 * `standingTally` without tallying every fact a second time (SAK-382). */
export function standingTallyOf(rows: readonly DiscoveryRow[]): CoverageCounts {
  const counts: Partial<Record<Standing, number>> = {};
  for (const row of rows) if (row.counts) addCounts(counts, row.counts);
  return counts;
}

export function standingTally(history: HistoryFile, stats: StatsData, now: number): CoverageCounts {
  const counts: Partial<Record<Standing, number>> = {};
  const subjects = stats.rows.flatMap((r) => (r.kind === "subject" ? [r.subject] : r.children));
  for (const subject of subjects) addCounts(counts, subjectTally(subject, history, now));
  addCounts(counts, sentenceTally(history, stats));
  return counts;
}

/** A subject's entries by standing: the worst of each entry's facts. Only
 * the touched entries are worked out; the rest are "not-seen", counted. */
function subjectTally(subject: StatsSubject, history: HistoryFile, now: number): CoverageCounts {
  const counts: Partial<Record<Standing, number>> = {};
  const thin = sparse(history);
  const some: ReadonlySet<string> | readonly string[] = thin ? touchedInSubject(subject, history) : (subject.entries as readonly string[]);
  for (const entry of some) {
    const facts = subject.entryFacts[entry] ?? [];
    let worst: AppStanding = "not-seen";
    for (const f of facts) {
      // nothing on it, nothing to work out (as in workOutStanding)
      if (!history.facts[f] && !history.claims?.[f] && !history.seen?.[f]) continue;
      const s = factStanding(f, history, now);
      if (WORST.indexOf(s) < WORST.indexOf(worst)) worst = s;
    }
    counts[worst] = (counts[worst] ?? 0) + 1;
  }
  if (thin) {
    const rest = subject.entries.length - (some as ReadonlySet<string>).size;
    if (rest > 0) counts["not-seen"] = (counts["not-seen"] ?? 0) + rest;
  }
  return counts;
}

/** Sentence tiers: learned ones are "claimed", the rest not seen. */
function sentenceTally(history: HistoryFile, stats: StatsData): CoverageCounts {
  const learned = Math.min(stats.sentenceTierCount, learnedSentenceTierIds(history).length);
  return { claimed: learned, "not-seen": stats.sentenceTierCount - learned };
}

function addCounts(into: Partial<Record<Standing, number>>, more: CoverageCounts): void {
  for (const [k, n] of Object.entries(more) as Array<[Standing, number]>) into[k] = (into[k] ?? 0) + n;
}

/** "x of y" per subject, grouped as Progress groups them, sentences last. */
export function discoveryRows(history: HistoryFile, stats: StatsData, now = Date.now()): DiscoveryRow[] {
  const row = (s: StatsSubject): DiscoveryRow => ({ label: SUBJECT_LABEL[s.id] ?? s.id, discovered: metCount(s, history), total: s.entries.length, counts: subjectTally(s, history, now) });
  const rows: DiscoveryRow[] = stats.rows.map((r) => {
    if (r.kind === "subject") return row(r.subject);
    const children = r.children.map(row);
    const counts: Partial<Record<Standing, number>> = {};
    for (const c of children) if (c.counts) addCounts(counts, c.counts);
    return { label: r.label, discovered: children.reduce((n, c) => n + c.discovered, 0), total: children.reduce((n, c) => n + c.total, 0), children, counts };
  });
  rows.push({ label: "Sentences", discovered: Math.min(stats.sentenceTierCount, learnedSentenceTierIds(history).length), total: stats.sentenceTierCount, counts: sentenceTally(history, stats) });
  return rows;
}

export interface SkyOptions {
  /** Show the whole finite sky: every kana, piece and kanji as a point,
   * discovered or not. Words still appear only once discovered. */
  everything?: boolean;
  /** More kinds than this adapter knows (the Observatory's counters,
   * grammar, rules, pairs and keigo): items to add with their parts, which
   * of them the learner has met, and which belong in the firmament as the
   * planets, asteroids and binaries not discovered yet. */
  beyond?: (history: HistoryFile, now: number) => { items: readonly SkyItem[]; met: readonly string[]; firmament?: readonly string[] };
  /** Clean runs in a row that clear a mix-up: the learner's setting. */
  graduateRuns?: number;
}

/** The signed-in learner's sky, or an empty one for a visitor. */
export async function learnerSky(now = Date.now(), options: SkyOptions = {}): Promise<SkyHomeData> {
  const userId = await currentUserId();
  const history = userId ? await loadHistory(userId) : emptyHistory();
  return skyFromHistory(history, now, await getStatsRows(), options);
}

/** The learner's items and what they have met, as a growing map: the home
 * starts from what is met; the Planetarium adds what is on offer with `add`. */
export interface SkyItems {
  items: Map<string, SkyItem>;
  met: Set<string>;
  firmament: string[];
  /** An entry and every part under it become items; met ones are recorded. */
  add: (entry: LibEntry) => void;
}

/** An empty sky and the way into it: `add` builds an entry and everything
 * under it. `skyItems` fills it with what the learner has met; a caller
 * that only wants a few entries built (practice's preview) starts here. */
export function skyAdder(history: HistoryFile, now = Date.now()): Pick<SkyItems, "items" | "met" | "add"> {
  const items = new Map<string, SkyItem>();
  const met = new Set<string>();

  // every part reached from an entry becomes an item too, so constellations are whole
  const add = (entry: LibEntry): void => {
    if (items.has(entry.id)) return;
    const parts = partsOf(entry);
    const { standing, met: isMet } = standingFor(entry, history, now);
    items.set(entry.id, toItem(entry, standing, parts));
    if (isMet) met.add(entry.id);
    for (const p of parts) add(p);
  };
  return { items, met, add };
}

export function skyItems(history: HistoryFile, now = Date.now(), options: SkyOptions = {}): SkyItems {
  const { items, met, add } = skyAdder(history, now);

  const firmament: string[] = [];
  for (const kind of [KANA_SUBJECT, RADICAL_SUBJECT, PRIMITIVE_SUBJECT, KANJI_SUBJECT, VOCAB_SUBJECT] as const) {
    for (const entry of LIB_ENTRIES_BY_KIND.get(kind) ?? []) {
      if (!entry.glyph) continue;
      // A radical taught as its kanji (radical:日 learns on kanji:日's card and
      // shares its meaning fact) is the same star as the kanji: one node, one
      // state. The kanji entry carries it; the radical entry is not a star.
      if (kind === RADICAL_SUBJECT && entryForGlyph(KANJI_SUBJECT, entry.glyph)) continue;
      // The firmament is everything that can be taught and drawn: every
      // kana, piece, kanji and word (Sam, 2026-09-06: nothing is excluded
      // from the Planetarium, so if it gets taught it is up there, and
      // everything behaves by its own filter wherever it is). A piece is a
      // star inside every kanji and word built from it AND a constellation
      // of its own, so turning Kanji off never takes a piece with it.
      // A piece written the same as a kanji is that kanji, one node with
      // one standing (see the skip above), so it answers to Kanji.
      const inFirmament = options.everything && (kind === KANA_SUBJECT || kind === RADICAL_SUBJECT || kind === PRIMITIVE_SUBJECT || kind === KANJI_SUBJECT || kind === VOCAB_SUBJECT);
      if (standingFor(entry, history, now).met) add(entry);
      else if (inFirmament) add(entry);
      if (inFirmament) firmament.push(entry.id);
    }
  }
  return { items, met, firmament, add };
}

/** The sky from a history file. Without `stats` the discovery rows are empty. */
export function skyFromHistory(history: HistoryFile, now = Date.now(), stats?: StatsData, options: SkyOptions = {}): SkyHomeData {
  const { items, met, firmament } = skyItems(history, now, options);
  // what another adapter adds: its own things replace any plainer version
  // of them here, its parts fill in only where missing
  const beyond = options.beyond?.(history, now);
  const beyondMet = new Set(beyond?.met ?? []);
  for (const it of beyond?.items ?? []) if (beyondMet.has(it.id) || !items.has(it.id)) items.set(it.id, it);
  for (const id of beyondMet) met.add(id);
  const list = [...items.values()];
  const graph = buildGraph(list);
  const roots = skyRoots(graph, met);
  const rootSet = new Set(roots);

  const needed = options.graduateRuns ?? GRADUATE_RUNS;
  const mixUps: MixUp[] = activeWeaknessPairs(history, needed, entryOf)
    .filter((p) => items.has(p.a) && items.has(p.b))
    .map((p) => ({ key: p.key, a: p.a, b: p.b, times: p.runsMixedUp, cleanRuns: p.cleanStreak, needed }));

  return {
    items: list, roots, mixUps,
    discovery: stats ? discoveryRows(history, stats, now) : [],
    standingCounts: stats ? standingTally(history, stats, now) : undefined,
    firmament: [...firmament, ...(beyond?.firmament ?? [])].filter((id) => !rootSet.has(id)),
  };
}
