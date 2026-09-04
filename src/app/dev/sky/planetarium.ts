// What the Planetarium offers, from the app's tables and the learner's
// history. Server-side and dev-only, like learner.ts: the one place the
// app's curricula (kana rows, the word order, counting, grammar, verb pairs,
// keigo) meet the Sky's item shape. At cutover this becomes the Sky's data
// layer for the page. Nothing in src/sky knows any of this exists.
//
// What is on offer, and in what shape:
//   kana rows   one item per row of a script, its kana as components, so a row
//               costs the sounds not yet known; the marks and blends also take
//               the plain row they build on, which the cart can supply
//   words       the curriculum's order, the next ones not yet met
//   counting    the counters track in its own order (〜つ first)
//   grammar     the patterns in the track's order, behind a kana gate
//   verb pairs  each attached to its plain verb as headword
//   keigo       each set attached to its plain verb
// Everything else in the sky rides along as parts, so costs are real.

import { SETS, kanaEntry, KANA_SUBJECT } from "@/data/characters";
import { COUNTER_CURRICULUM, counterEntry } from "@/data/counters";
import { patternEntry } from "@/data/grammar";
import { kanjiRow } from "@/data/kanji";
import { KEIGO_SETS, keigoSetEntry } from "@/data/keigo";
import { VERB_PAIRS } from "@/data/transitivity";
import { pairEntry } from "@/data/transitivity-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { currentUserId } from "@/lib/auth";
import { CURRICULUM_PATTERNS } from "@/lib/grammar-lesson";
import { emptyHistory } from "@/lib/history-ops";
import { loadHistory } from "@/lib/history";
import { entryForGlyph, libEntry, type LibEntry } from "@/lib/library/entries";
import { CURRICULUM_KEBS_ORDERED } from "@/lib/word-rank";
import type { PlanetariumSection, SkyPlanetariumData } from "@/sky/components/sky-planetarium";
import type { SkyItem, SkyKind } from "@/sky/lib/types";
import type { HistoryFile } from "@/types";

import { componentEntry, skyItems, standingFor } from "./learner";

/** How many of a long section to show; the section says how many exist. */
const SHOW = 24;

/** The plain row each mark or blend row builds on, by the row id's suffix. */
const BASE_ROW: Record<string, string> = { g: "k", z: "s", d: "t", bp: "h", kya: "k", sha: "s", cha: "t", nya: "n", hya: "h", mya: "m", rya: "r", gya: "g", ja: "z", dja: "d", bya: "bp", pya: "bp" };

/** "K か" is the K row; "Vowels あ" the vowels; "Yōon き" the ky blends. */
function rowName(label: string, firstRomaji: string): string {
  const bare = label.replace(/[぀-ヿ]/g, "").replace(/\s+/g, " ").trim();
  if (bare === "Vowels") return bare;
  if (bare.startsWith("Yōon")) return `Yōon ${firstRomaji.replace(/[aiueo]+$/, "")} row`;
  if (bare.endsWith("+")) return `${bare.slice(0, -1).trim()} row + n`;
  return `${bare} row`;
}

/** The signed-in learner's Planetarium, or a visitor's. */
export async function learnerPlanetarium(now = Date.now()): Promise<SkyPlanetariumData> {
  const userId = await currentUserId();
  const history = userId ? await loadHistory(userId) : emptyHistory();
  return planetariumFromHistory(history, now);
}

export function planetariumFromHistory(history: HistoryFile, now = Date.now()): SkyPlanetariumData {
  const sky = skyItems(history, now);
  const { items, met, add } = sky;
  const learned = new Set(met);
  const sections: PlanetariumSection[] = [];

  /** An app entry on offer: added with its parts, given the sky kind it is picked as. */
  const offer = (entry: LibEntry, kind: SkyKind, extra: Partial<SkyItem> = {}): SkyItem => {
    add(entry);
    const item = { ...items.get(entry.id)!, kind, ...extra };
    items.set(entry.id, item);
    return item;
  };
  const wordEntry = (keb: string): LibEntry | undefined => { const id = entryForGlyph(VOCAB_SUBJECT, keb); return id ? libEntry(id) : undefined; };
  const kanjiIn = (text: string): string[] => [...text].filter((c) => kanjiRow(c)).map((c) => componentEntry(c)).filter((e): e is LibEntry => !!e).map((e) => { add(e); return e.id; });

  // kana: one item per row, the row's kana under it
  for (const set of SETS) {
    const rows: string[] = [];
    for (const section of set.sections) {
      const kana = section.chars.map((ch) => libEntry(kanaEntry(ch.c))).filter((e): e is LibEntry => !!e);
      for (const e of kana) add(e);
      const id = `kana-row:${section.id}`;
      const allMet = kana.every((e) => met.has(e.id));
      const suffix = section.id.replace(/^[hk]-/, "");
      const base = BASE_ROW[suffix] ? `kana-row:${section.id.slice(0, 2)}${BASE_ROW[suffix]}` : undefined;
      items.set(id, {
        id, kind: "kana", glyph: section.chars[0].c, english: rowName(section.label, section.chars[0].r[0]),
        standing: allMet ? "claimed" : "not-seen",
        group: true,
        components: [...kana.map((e) => e.id), ...(base ? [base] : [])],
      });
      if (allMet) learned.add(id); else rows.push(id);
    }
    sections.push({ id: set.id, title: set.label, hint: set.id === "hiragana" ? "Rows you have not finished. The marks and blends build on the plain rows, which come along when they are not in your sky yet." : undefined, items: rows });
  }

  // words: the curriculum's order, next ones first
  const words = CURRICULUM_KEBS_ORDERED.map(wordEntry).filter((e): e is LibEntry => !!e && !standingFor(e, history, now).met);
  sections.push({ id: "words", title: "Words", hint: "Shown by meaning. A word brings its kanji and the pieces they are built from.", items: words.slice(0, SHOW).map((e) => offer(e, "word").id), total: words.length });

  // counting: the track's own order
  const counting = COUNTER_CURRICULUM.map((f) => libEntry(counterEntry(f))).filter((e): e is LibEntry => !!e && !standingFor(e, history, now).met);
  sections.push({ id: "counting", title: "Counting", hint: "Listed by what they count. Japanese picks a counter by the shape of the thing.", items: counting.slice(0, SHOW).map((e) => offer(e, "counter").id), total: counting.length });

  // grammar: behind the plain hiragana
  const plainHiragana = SETS[0].sections.slice(0, 10).flatMap((s) => s.chars.map((ch) => kanaEntry(ch.c)));
  const haveHiragana = plainHiragana.filter((id) => met.has(id)).length;
  const grammar = CURRICULUM_PATTERNS.map((r) => libEntry(patternEntry(r.id))).filter((e): e is LibEntry => !!e && !standingFor(e, history, now).met);
  sections.push({
    id: "grammar", title: "Grammar", hint: "Shown by what it does.",
    items: grammar.slice(0, SHOW).map((e) => offer(e, "grammar").id), total: grammar.length,
    gate: haveHiragana < plainHiragana.length ? { requirement: "Grammar opens once you can read hiragana. The plain rows first; the marks and blends can come later.", progress: { have: haveHiragana, need: plainHiragana.length, unit: "hiragana" } } : undefined,
  });

  // verb pairs: attached to the plain verb, with both members' kanji
  const pairs: string[] = [];
  for (const p of VERB_PAIRS) {
    const entry = libEntry(pairEntry(p));
    if (!entry || standingFor(entry, history, now).met) continue;
    const head = wordEntry(p.happens.word);
    if (head) add(head);
    pairs.push(offer(entry, "verbPair", { headword: head?.id, components: [...new Set([...kanjiIn(p.happens.word), ...kanjiIn(p.doIt.word)])] }).id);
  }
  sections.push({ id: "verb-pairs", title: "Verb pairs", hint: "A verb and its partner: one for what happens, one for doing it. A pair needs its plain verb first.", items: pairs.slice(0, SHOW), total: pairs.length });

  // keigo: attached to the plain verb, with the polite words' kanji
  const keigo: string[] = [];
  for (const set of KEIGO_SETS) {
    const entry = libEntry(keigoSetEntry(set));
    if (!entry || standingFor(entry, history, now).met) continue;
    const head = set.gate.map(wordEntry).find((e): e is LibEntry => !!e);
    if (head) add(head);
    keigo.push(offer(entry, "keigo", { english: set.meaning, headword: head?.id, components: [...new Set(set.words.flatMap((w) => kanjiIn(w.word)))] }).id);
  }
  sections.push({ id: "keigo", title: "Keigo", hint: "Polite forms of verbs you know. Each needs its plain verb first.", items: keigo });

  void KANA_SUBJECT;
  return { items: [...items.values()], learned: [...learned], sections };
}
