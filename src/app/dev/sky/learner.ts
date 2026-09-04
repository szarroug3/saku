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
import { entryForGlyph, knownFactsOf, libEntry, LIB_ENTRIES_BY_KIND, type LibEntry } from "@/lib/library/entries";
import { KIND_LABEL } from "@/lib/library/kinds";
import { getStatsRows, type StatsData, type StatsSubject } from "@/lib/library/server-lookups";
import { standingOf as appStandingOf, type Standing as AppStanding } from "@/lib/library/standing";
import { learnedSentenceTierIds } from "@/lib/sentence-ordering-learned";
import { buildGraph } from "@/sky/lib/graph";
import type { DiscoveryRow } from "@/sky/components/discovery-panel";
import type { MixUp } from "@/sky/components/mix-ups-panel";
import type { SkyHomeData } from "@/sky/components/sky-home";
import { skyRoots } from "@/sky/lib/sky-scene";
import type { Standing } from "@/sky/lib/standing";
import type { SkyItem, SkyKind } from "@/sky/lib/types";
import type { HistoryFile } from "@/types";

const GRADUATE_RUNS = 10;

/** Worst first: the colour a multi-fact entry's star wears. */
const WORST: readonly AppStanding[] = ["slipping", "shaky", "getting-there", "claimed", "solid", "not-seen"];

const KIND: Partial<Record<string, SkyKind>> = { [KANA_SUBJECT]: "kana", [RADICAL_SUBJECT]: "radical", [PRIMITIVE_SUBJECT]: "radical", [KANJI_SUBJECT]: "kanji", [VOCAB_SUBJECT]: "word" };

function standingFor(entry: LibEntry, history: HistoryFile, now: number): { standing: Standing; met: boolean } {
  const facts = knownFactsOf(entry);
  let met = false;
  let worst: AppStanding = "not-seen";
  let anySeen = false;
  for (const f of facts) {
    const agg = history.facts[f];
    const claimedAt = history.claims?.[f];
    if ((agg?.seen ?? 0) > 0 || claimedAt || history.seen?.[f]) met = true;
    const s = appStandingOf(agg, claimedAt, now).standing;
    if (s !== "not-seen") anySeen = true;
    if (WORST.indexOf(s) < WORST.indexOf(worst)) worst = s;
  }
  return { standing: anySeen ? worst : "not-seen", met };
}

/** The entry a component glyph refers to: a kanji, a radical or a primitive. */
function componentEntry(glyph: string): LibEntry | undefined {
  const id = entryForGlyph(KANJI_SUBJECT, glyph) ?? entryForGlyph(RADICAL_SUBJECT, glyph) ?? entryForGlyph(PRIMITIVE_SUBJECT, glyph);
  return id ? libEntry(id) : undefined;
}

/** The parts an entry is made of, as entries: a word's kanji, a kanji's components. */
function partsOf(entry: LibEntry): LibEntry[] {
  if (entry.kind === VOCAB_SUBJECT) return [...entry.glyph].map((c) => (kanjiRow(c) ? componentEntry(c) : undefined)).filter((e): e is LibEntry => !!e);
  if (entry.kind === KANJI_SUBJECT) return (kanjiRow(entry.glyph)?.comps ?? []).map(componentEntry).filter((e): e is LibEntry => !!e);
  return [];
}

function toItem(entry: LibEntry, standing: Standing, parts: readonly LibEntry[]): SkyItem {
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

/** Entries in a subject the learner has met: any of the entry's facts answered or claimed. */
const metCount = (subject: StatsSubject, history: HistoryFile) =>
  subject.entries.filter((e) => (subject.entryFacts[e as unknown as string] ?? []).some((f) => history.facts[f]?.seen || history.claims?.[f])).length;

/** "x of y" per subject, grouped as Progress groups them, sentences last. */
export function discoveryRows(history: HistoryFile, stats: StatsData): DiscoveryRow[] {
  const row = (s: StatsSubject): DiscoveryRow => ({ label: SUBJECT_LABEL[s.id] ?? s.id, discovered: metCount(s, history), total: s.entries.length });
  const rows: DiscoveryRow[] = stats.rows.map((r) =>
    r.kind === "subject" ? row(r.subject) : { label: r.label, discovered: r.children.reduce((n, s) => n + metCount(s, history), 0), total: r.children.reduce((n, s) => n + s.entries.length, 0), children: r.children.map(row) },
  );
  rows.push({ label: "Sentences", discovered: learnedSentenceTierIds(history).length, total: stats.sentenceTierCount });
  return rows;
}

export interface SkyOptions {
  /** Show the whole finite sky: every kana, piece and kanji as a point,
   * discovered or not. Words still appear only once discovered. */
  everything?: boolean;
}

/** The signed-in learner's sky, or an empty one for a visitor. */
export async function learnerSky(now = Date.now(), options: SkyOptions = {}): Promise<SkyHomeData> {
  const userId = await currentUserId();
  const history = userId ? await loadHistory(userId) : emptyHistory();
  return skyFromHistory(history, now, await getStatsRows(), options);
}

/** The sky from a history file. Without `stats` the discovery rows are empty. */
export function skyFromHistory(history: HistoryFile, now = Date.now(), stats?: StatsData, options: SkyOptions = {}): SkyHomeData {
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

  const firmament: string[] = [];
  for (const kind of [KANA_SUBJECT, RADICAL_SUBJECT, PRIMITIVE_SUBJECT, KANJI_SUBJECT, VOCAB_SUBJECT] as const) {
    for (const entry of LIB_ENTRIES_BY_KIND.get(kind) ?? []) {
      if (!entry.glyph) continue;
      // A radical taught as its kanji (radical:日 learns on kanji:日's card and
      // shares its meaning fact) is the same star as the kanji: one node, one
      // state. The kanji entry carries it; the radical entry is not a star.
      if (kind === RADICAL_SUBJECT && entryForGlyph(KANJI_SUBJECT, entry.glyph)) continue;
      const single = kind !== VOCAB_SUBJECT;
      if (standingFor(entry, history, now).met) add(entry);
      else if (options.everything && single) add(entry);
      if (options.everything && single) firmament.push(entry.id);
    }
  }

  const list = [...items.values()];
  const graph = buildGraph(list);
  const roots = skyRoots(graph, met);
  const rootSet = new Set(roots);

  const mixUps: MixUp[] = activeWeaknessPairs(history, GRADUATE_RUNS, entryOf)
    .filter((p) => items.has(p.a) && items.has(p.b))
    .map((p) => ({ a: p.a, b: p.b, times: p.runsMixedUp }));

  return { items: list, roots, mixUps, discovery: stats ? discoveryRows(history, stats) : [], firmament: firmament.filter((id) => !rootSet.has(id)) };
}
