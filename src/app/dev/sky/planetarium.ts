// What the Planetarium offers, from the app's tables and the learner's
// history. Server-side and dev-only, like learner.ts: the one place the
// app's curricula (kana rows, the word order, counting, grammar, verb pairs,
// keigo) meet the Sky's item shape. At cutover this becomes the Sky's data
// layer for the page. Nothing in src/sky knows any of this exists.
//
// What is on offer, and in what shape:
//   kana        one item per row of either script, its kana as components, so
//               a row costs the sounds not yet known; the marks and blends
//               also take the plain row they build on, which the cart can
//               supply. Hiragana rows first, then katakana
//   words       the curriculum's order, the next ones not yet met
//   counting    the counters track in its own order (〜つ first)
//   grammar     the patterns in the track's order
//   verb pairs  each attached to its plain verb as headword
//   keigo       each set attached to its plain verb
// Everything else in the sky rides along as parts, so costs are real.
//
// KANA IS THE GATE, as on the app's home: every other track opens once the
// kana are done (the app's rule: finish or claim the last kana group). Each
// section says what it is and when to start it, in the app's own words.

import { SETS, kanaEntry } from "@/data/characters";
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

/** How many of a long section to offer; the page lays out fewer and says how many exist. */
const SHOW = 24;

/** What each track is and when to start it. Short, in the learner's terms. */
const COPY = {
  kana: {
    intro: "Kana are the sounds of Japanese. Each one is a syllable, and together they tell you how to pronounce anything that is written.",
    when: "Learn these first. Once you know them you can read, and everything else opens.",
  },
  words: {
    intro: "Words are the part you actually speak and read. A word brings its kanji and the pieces they are built from, so you assemble it instead of memorising it whole.",
    when: "Start as soon as kana is done. This is the main track, and it keeps going.",
  },
  counting: {
    intro: "Japanese counts with a small word that changes with what you count: one for people, one for long things, one for flat ones.",
    when: "Start anytime after kana. You will want these the first time you order two of something.",
  },
  grammar: {
    intro: "Sentences are not built the way English builds them. The order is different, and small words mark who did what. A pattern is learned once and reused on every word you know.",
    when: "Start once single words feel limiting, when you want to say \"I ate\" or \"please eat\", not just \"eat\".",
  },
  verbPairs: {
    intro: "Many verbs come in pairs: one for what happens on its own, one for someone doing it. The door opens; I open the door.",
    when: "Each pair opens once you know its plain verb.",
  },
  keigo: {
    intro: "Japanese changes a verb by who you are speaking to. A polite verb replaces the plain one outright: a separate word, not an ending.",
    when: "Each set opens once you know the plain verb it replaces.",
  },
} as const;

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

  // kana: one item per row of either script, the row's kana under it
  const rows: string[] = [];
  let kanaTotal = 0, kanaMet = 0;
  for (const set of SETS) {
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
      kanaTotal += kana.length;
      kanaMet += kana.filter((e) => met.has(e.id)).length;
      if (allMet) learned.add(id); else rows.push(id);
    }
  }
  sections.push({ id: "kana", title: "Kana", ...COPY.kana, items: rows });
  const kanaDone = kanaMet >= kanaTotal;
  const afterKana = kanaDone ? undefined : { requirement: "Opens once kana is done. Everything else is read through it.", progress: { have: kanaMet, need: kanaTotal, unit: "kana" } };

  // words: the curriculum's order, next ones first
  const words = CURRICULUM_KEBS_ORDERED.map(wordEntry).filter((e): e is LibEntry => !!e && !standingFor(e, history, now).met);
  sections.push({ id: "words", title: "Words", ...COPY.words, items: words.slice(0, SHOW).map((e) => offer(e, "word").id), total: words.length, gate: afterKana });

  // counting: the track's own order
  const counting = COUNTER_CURRICULUM.map((f) => libEntry(counterEntry(f))).filter((e): e is LibEntry => !!e && !standingFor(e, history, now).met);
  sections.push({ id: "counting", title: "Counting", ...COPY.counting, items: counting.slice(0, SHOW).map((e) => offer(e, "counter").id), total: counting.length, gate: afterKana });

  // grammar: sentence rules, in the track's order
  const grammar = CURRICULUM_PATTERNS.map((r) => libEntry(patternEntry(r.id))).filter((e): e is LibEntry => !!e && !standingFor(e, history, now).met);
  sections.push({ id: "grammar", title: "Sentence rules", ...COPY.grammar, items: grammar.slice(0, SHOW).map((e) => offer(e, "grammar").id), total: grammar.length, gate: afterKana });

  // verb pairs: attached to the plain verb, with both members' kanji
  const pairs: string[] = [];
  for (const p of VERB_PAIRS) {
    const entry = libEntry(pairEntry(p));
    if (!entry || standingFor(entry, history, now).met) continue;
    const head = wordEntry(p.happens.word);
    if (head) add(head);
    pairs.push(offer(entry, "verbPair", { headword: head?.id, components: [...new Set([...kanjiIn(p.happens.word), ...kanjiIn(p.doIt.word)])] }).id);
  }
  sections.push({ id: "verb-pairs", title: "Verb pairs", ...COPY.verbPairs, items: pairs.slice(0, SHOW), total: pairs.length, gate: afterKana });

  // keigo: attached to the plain verb, with the polite words' kanji
  const keigo: string[] = [];
  for (const set of KEIGO_SETS) {
    const entry = libEntry(keigoSetEntry(set));
    if (!entry || standingFor(entry, history, now).met) continue;
    const head = set.gate.map(wordEntry).find((e): e is LibEntry => !!e);
    if (head) add(head);
    keigo.push(offer(entry, "keigo", { english: set.meaning, headword: head?.id, components: [...new Set(set.words.flatMap((w) => kanjiIn(w.word)))] }).id);
  }
  sections.push({ id: "keigo", title: "Keigo", ...COPY.keigo, items: keigo, gate: afterKana });

  return { items: [...items.values()], learned: [...learned], sections };
}
