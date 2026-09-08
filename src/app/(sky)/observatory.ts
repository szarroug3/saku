// What the Observatory offers, from the app's tables and the learner's
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

import { KANA_SUBJECT, SETS, kanaEntry } from "@/data/characters";
import { TERM_SUBJECT } from "@/data/terms";
import { MARK_SUBJECT } from "@/data/marks";
import { GRAMMAR_CONCEPT_SUBJECT } from "@/data/grammar-concepts";
import { PRIMITIVE_SUBJECT } from "@/data/components";
import { RADICAL_SUBJECT } from "@/data/radicals";
import { COUNTER_CURRICULUM, counterEntry } from "@/data/counters";
import { GRAMMAR_SUBJECT, patternEntry } from "@/data/grammar";
import { KANJI_SUBJECT, kanjiRow } from "@/data/kanji";
import { KEIGO_SETS, KEIGO_SUBJECT, keigoSetEntry, keigoSetForEntry, type KeigoSet } from "@/data/keigo";
import { VERB_PAIRS, type VerbPair } from "@/data/transitivity";
import { pairEntry, pairForEntry, TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { currentUserId } from "@/lib/auth";
import { CURRICULUM_PATTERNS } from "@/lib/grammar-lesson";
import { emptyHistory } from "@/lib/history-ops";
import { loadHistory } from "@/lib/history";
import { COUNTER_KIND, entryForGlyph, knownFactsOf, LIB_ENTRIES_BY_KIND, libEntry, NUMBER_CONSTRUCTION_KIND, SENTENCE_RULE_KIND, type LibEntry } from "@/lib/library/entries";
import { sentenceTierShortLabel } from "@/data/assembly";
import { CURRICULUM_KEBS_ORDERED } from "@/lib/word-rank";
import type { ObservatorySection, SkyObservatoryData } from "@/sky/components/sky-observatory";
import type { SkyItem, SkyKind } from "@/sky/lib/types";
import type { FactId, HistoryFile } from "@/types";

import { componentEntry, skyAdder, skyItems, standingFor, type SkyItems } from "./learner";

/** How many of a long section to offer; the page lays out fewer. */
const SHOW = 24;

/** The native numbers (ひとつ to とお) as one pick: the 〜つ rule. */
export const TSU_RULE = "counter-rule:tsu";

/** What each track is and when to start it. Short, in the learner's terms. */
const COPY = {
  kana: {
    intro: "Kana are the sounds of Japanese. Each one is a syllable, and together they tell you how to pronounce anything that is written.",
    when: "Learn these first. Once you know them you can read, and everything else opens.",
  },
  words: {
    intro: "Words are the part you speak and read. A word brings its kanji and the pieces they are built from, so you assemble it instead of memorizing it whole.",
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

/** The two sides of a verb pair as one name, "to get dirty · to make dirty":
 * the first meaning of each side that shares a word with one of the other's
 * ("dirty" in both, "mend" in "mended"), since a dictionary lists "to pollute"
 * before "to make dirty"; the first of each otherwise. */
const FILLER = new Set(["the", "and", "get", "become", "make", "let", "have", "etc", "one", "for", "with", "into", "out"]);
function pairName(happens: readonly string[], doIt: readonly string[]): string | undefined {
  const words = (m: string) => m.toLowerCase().replace(/\(.*?\)/g, "").split(/[^a-z]+/).filter((w) => w.length >= 3 && !FILLER.has(w));
  const related = (a: string, b: string) => words(a).some((x) => words(b).some((y) => x.startsWith(y) || y.startsWith(x)));
  for (const h of happens) for (const d of doIt) if (related(h, d)) return `${h} · ${d}`;
  if (happens[0] && doIt[0]) return `${happens[0]} · ${doIt[0]}`;
  return happens[0] ?? doIt[0];
}

/** The signed-in learner's Observatory, or a visitor's. */
export async function learnerObservatory(now = Date.now()): Promise<SkyObservatoryData> {
  const userId = await currentUserId();
  const history = userId ? await loadHistory(userId) : emptyHistory();
  return observatoryFromHistory(history, now);
}

export function observatoryFromHistory(history: HistoryFile, now = Date.now()): SkyObservatoryData {
  const { items, learned, sections } = offerings(history, now);
  return { items: [...items.values()], learned: [...learned], sections };
}

/** What the Observatory builds, kept open: the items and what is learned as
 * they grow, the sections, and `offerPick`, which adds any pick by id (a
 * word beyond the first page, a row, a rule) with everything under it, so
 * the lesson can build exactly what was picked. */
export interface Offerings {
  items: Map<string, SkyItem>;
  learned: Set<string>;
  sections: ObservatorySection[];
  offerPick: (id: string) => SkyItem | undefined;
}

/** The ways an entry is offered, over a sky: the plain offer with a kind,
 * the two that dress an entry in its words' kanji, and `offerPick`, any
 * pick by id. Apart from the sections so a caller that wants a few items
 * built the Observatory's way (practice's preview, SAK-382) does not walk
 * the whole sky and every section first. */
function picker(sky: Pick<SkyItems, "items" | "add">) {
  const { items, add } = sky;

  /** An app entry on offer: added with its parts, given the sky kind it is picked as. */
  const offer = (entry: LibEntry, kind: SkyKind, extra: Partial<SkyItem> = {}): SkyItem => {
    add(entry);
    const item = { ...items.get(entry.id)!, kind, ...extra };
    items.set(entry.id, item);
    return item;
  };
  const wordEntry = (keb: string): LibEntry | undefined => { const id = entryForGlyph(VOCAB_SUBJECT, keb); return id ? libEntry(id) : undefined; };
  const kanjiIn = (text: string): string[] => [...text].filter((c) => kanjiRow(c)).map((c) => componentEntry(c)).filter((e): e is LibEntry => !!e).map((e) => { add(e); return e.id; });

  // a verb pair: attached to the plain verb, with both members' kanji
  const offerPair = (p: VerbPair, entry: LibEntry): SkyItem => {
    const head = wordEntry(p.happens.word);
    if (head) add(head);
    // named by its two words' own meanings, "to get dirty · to make dirty":
    // the pair table carries example sentences, not a name
    const doIt = wordEntry(p.doIt.word);
    const english = pairName(head?.meanings ?? [], doIt?.meanings ?? []) ?? entry.meanings[0] ?? p.happens.en;
    // the pair shows as what its two verbs share, the kanji (出 for 出る and
    // 出す), since neither verb alone is the pair (Sam's call, 2026-09-05)
    const shared = [...p.happens.word].filter((c) => kanjiRow(c) && p.doIt.word.includes(c)).join("");
    return offer(entry, "verbPair", { english, glyph: shared || entry.glyph, reading: undefined, headword: head?.id, components: [...new Set([...kanjiIn(p.happens.word), ...kanjiIn(p.doIt.word)])] });
  };

  // a keigo set: attached to the plain verb, with the polite words' kanji
  const offerKeigo = (set: KeigoSet, entry: LibEntry): SkyItem => {
    const head = set.gate.map(wordEntry).find((e): e is LibEntry => !!e);
    if (head) add(head);
    return offer(entry, "keigo", { english: set.meaning, headword: head?.id, components: [...new Set(set.words.flatMap((w) => kanjiIn(w.word)))] });
  };

  /** Any pick by id, built the way its section would build it. */
  const offerPick = (id: string): SkyItem | undefined => {
    const have = items.get(id);
    if (have) return have;
    const entry = libEntry(id as Parameters<typeof libEntry>[0]);
    if (!entry) return undefined;
    switch (entry.kind) {
      case COUNTER_KIND: return offer(entry, "counter");
      // a counting rule (numbers 11 to 99, the 〜本 counter's system): counted with the counters
      case NUMBER_CONSTRUCTION_KIND: return offer(entry, "counter", { english: entry.name ?? entry.meanings[0] ?? entry.id });
      case GRAMMAR_SUBJECT: return offer(entry, "grammar");
      // a sentence rule has no glyph of its own: its short label stands in, as on the app's tiles
      case SENTENCE_RULE_KIND: { const name = sentenceTierShortLabel(entry.name ?? entry.meanings[0] ?? entry.id); return offer(entry, "sentence", { english: name, glyph: name }); }
      case TRANSITIVITY_SUBJECT: { const p = pairForEntry(entry.id); return p ? offerPair(p, entry) : undefined; }
      case KEIGO_SUBJECT: { const set = keigoSetForEntry(entry.id); return set ? offerKeigo(set, entry) : undefined; }
      // a kana, a piece or a kanji picked on its own (the Atlas does): its own kind
      case KANA_SUBJECT: return offer(entry, "kana");
      case RADICAL_SUBJECT:
      case PRIMITIVE_SUBJECT: return offer(entry, "radical");
      case KANJI_SUBJECT: return offer(entry, "kanji");
      // a term is its name: a page to read, never a star
      case TERM_SUBJECT: { const name = entry.name ?? entry.glyph; return offer(entry, "term", { english: name, glyph: name }); }
      // a writing rule is its mark where it has one (゛, っ), else its name
      // (long vowels, rendaku); a grammar concept is its name. Pages to read.
      case MARK_SUBJECT: { const name = entry.name ?? entry.glyph; return offer(entry, "mark", { english: name, glyph: entry.glyph || name }); }
      case GRAMMAR_CONCEPT_SUBJECT: { const name = entry.name ?? entry.glyph; return offer(entry, "concept", { english: name, glyph: name }); }
      default: return offer(entry, "word");
    }
  };

  return { offer, offerPair, offerKeigo, offerPick };
}

/** Whether `offerPick` would offer an entry, without building anything:
 * every entry is offered except a verb pair or keigo set with no table row
 * behind it. An offered item's id is the entry's own. For a caller that
 * wants ids alone, over a whole shelf (the Atlas's streamed cuts). */
export function hasOffer(entry: LibEntry): boolean {
  switch (entry.kind) {
    case TRANSITIVITY_SUBJECT: return !!pairForEntry(entry.id);
    case KEIGO_SUBJECT: return !!keigoSetForEntry(entry.id);
    default: return true;
  }
}

/** Any pick by id, built the way the Observatory would offer it, without
 * the Observatory: the sky starts empty and only what is picked is built,
 * and `items` holds just that (with everything under it, so a closure over
 * it is whole). The picks only the Observatory builds (a kana row, the 〜つ
 * rule) have no library entry; asked for one of those, this builds the
 * Observatory after all and takes its items in, so every id answers as it
 * did when every caller built the whole thing (SAK-382). */
export function offerPicker(history: HistoryFile, now = Date.now()): Pick<Offerings, "items" | "offerPick"> {
  const sky = skyAdder(history, now);
  const { offerPick } = picker(sky);
  let whole: Offerings | undefined;
  return {
    items: sky.items,
    offerPick: (id) => {
      // only the Observatory's own ids go to the Observatory: any other id
      // the library does not know is nothing, not a reason to build it all
      // (a session card for a word since dropped from the library did, and
      // that was the whole cost of the Sessions page)
      if (!id.startsWith("kana-row:") && id !== TSU_RULE) return offerPick(id);
      if (!whole) {
        whole = offerings(history, now);
        for (const [k, v] of whole.items) if (!sky.items.has(k)) sky.items.set(k, v);
      }
      return whole.offerPick(id);
    },
  };
}

export function offerings(history: HistoryFile, now = Date.now()): Offerings {
  const sky = skyItems(history, now);
  const { items, met, add } = sky;
  const learned = new Set(met);
  const sections: ObservatorySection[] = [];
  const { offer, offerPair, offerKeigo, offerPick } = picker(sky);
  const wordEntry = (keb: string): LibEntry | undefined => { const id = entryForGlyph(VOCAB_SUBJECT, keb); return id ? libEntry(id) : undefined; };

  // kana: one item per row of either script, the row's kana under it
  const rows: string[] = [];
  let kanaTotal = 0, kanaMet = 0;
  // every hiragana row comes before any katakana (Sam's rule, 2026-09-05):
  // the katakana vowels build on all of hiragana, and the rest of katakana
  // on its vowels
  const hiraganaRows: string[] = [];
  for (const set of SETS) {
    for (const section of set.sections) {
      const kana = section.chars.map((ch) => libEntry(kanaEntry(ch.c))).filter((e): e is LibEntry => !!e);
      for (const e of kana) add(e);
      const id = `kana-row:${section.id}`;
      const allMet = kana.every((e) => met.has(e.id));
      // every row builds on something: a mark or blend on its plain row, a
      // plain row on the vowels (Sam's rule: the vowels come first)
      const suffix = section.id.replace(/^[hk]-/, "");
      const baseSuffix = BASE_ROW[suffix] ?? (suffix === "vowels" ? undefined : "vowels");
      const base = baseSuffix ? `kana-row:${section.id.slice(0, 2)}${baseSuffix}` : undefined;
      const builtOn = base ? [base] : section.id === "k-vowels" ? hiraganaRows : [];
      if (section.id.startsWith("h-")) hiraganaRows.push(id);
      items.set(id, {
        id, kind: "kana", glyph: section.chars[0].c, english: rowName(section.label, section.chars[0].r[0]),
        standing: allMet ? "claimed" : "not-seen",
        group: true,
        components: [...kana.map((e) => e.id), ...builtOn],
      });
      kanaTotal += kana.length;
      kanaMet += kana.filter((e) => met.has(e.id)).length;
      if (allMet) learned.add(id); else rows.push(id);
    }
  }
  sections.push({ id: "kana", title: "Kana", ...COPY.kana, items: rows, started: kanaMet > 0, complete: rows.length === 0 });
  const kanaDone = kanaMet >= kanaTotal;
  const afterKana = kanaDone ? undefined : { requirement: "Opens once kana is done. Everything else is read through it.", progress: { have: kanaMet, need: kanaTotal, unit: "kana" } };

  // words: the curriculum's order, next ones first
  const allWords = CURRICULUM_KEBS_ORDERED.map(wordEntry).filter((e): e is LibEntry => !!e);
  const words = allWords.filter((e) => !standingFor(e, history, now).met);
  sections.push({ id: "words", title: "Words", ...COPY.words, items: words.slice(0, SHOW).map((e) => offer(e, "word").id), gate: afterKana, started: words.length < allWords.length, complete: words.length === 0 });

  // counting: the track's own order. The native numbers are one rule, not
  // ten picks (Sam, 2026-09-05): a pick with the ten forms under it
  const allCounting = COUNTER_CURRICULUM.map((f) => libEntry(counterEntry(f))).filter((e): e is LibEntry => !!e);
  const tsu = COUNTER_CURRICULUM.filter((f) => f.counter === "つ").map((f) => libEntry(counterEntry(f))).filter((e): e is LibEntry => !!e);
  for (const e of tsu) offer(e, "counter");
  items.set(TSU_RULE, { id: TSU_RULE, kind: "counter", glyph: "〜つ", english: "Native numbers", standing: tsu.every((e) => met.has(e.id)) ? "claimed" : "not-seen", components: tsu.map((e) => e.id), listsParts: true });
  const counting = allCounting.filter((e) => !standingFor(e, history, now).met);
  sections.push({ id: "counting", title: "Counting", ...COPY.counting, items: counting.slice(0, SHOW).map((e) => offer(e, "counter").id), gate: afterKana, started: counting.length < allCounting.length, complete: counting.length === 0 });

  // grammar: sentence rules, in the track's order
  const allGrammar = CURRICULUM_PATTERNS.map((r) => libEntry(patternEntry(r.id))).filter((e): e is LibEntry => !!e);
  const grammar = allGrammar.filter((e) => !standingFor(e, history, now).met);
  sections.push({ id: "grammar", title: "Sentence rules", ...COPY.grammar, items: grammar.slice(0, SHOW).map((e) => offer(e, "grammar").id), gate: afterKana, started: grammar.length < allGrammar.length, complete: grammar.length === 0 });

  // verb pairs: attached to the plain verb, with both members' kanji
  const pairs: string[] = [];
  let pairsMet = 0;
  for (const p of VERB_PAIRS) {
    const entry = libEntry(pairEntry(p));
    if (!entry) continue;
    if (standingFor(entry, history, now).met) { pairsMet++; continue; }
    pairs.push(offerPair(p, entry).id);
  }
  sections.push({ id: "verb-pairs", title: "Verb pairs", ...COPY.verbPairs, items: pairs.slice(0, SHOW), gate: afterKana, started: pairsMet > 0, complete: pairs.length === 0 });

  // keigo: attached to the plain verb, with the polite words' kanji
  const keigo: string[] = [];
  let keigoMet = 0;
  for (const set of KEIGO_SETS) {
    const entry = libEntry(keigoSetEntry(set));
    if (!entry) continue;
    if (standingFor(entry, history, now).met) { keigoMet++; continue; }
    keigo.push(offerKeigo(set, entry).id);
  }
  sections.push({ id: "keigo", title: "Keigo", ...COPY.keigo, items: keigo, gate: afterKana, started: keigoMet > 0, complete: keigo.length === 0 });

  return { items, learned, sections, offerPick };
}

/** Everything beyond kana, pieces, kanji and words: every counter, grammar
 * pattern, sentence rule, verb pair and keigo set, built the way the
 * Observatory offers them (so a pair is named by its two meanings and a rule
 * by its short label) with every part under them, for the Planetarium's sky.
 * These are the planets, asteroids and binaries; the learner's adapter draws
 * only stars itself.
 *
 * Met ones become constellations in the sky. The rest go in the firmament
 * (Sam, 2026-09-06): the undiscovered sky was every kana and kanji and
 * nothing else, so a learner saw no planet or asteroid until they had
 * learned one, while the legend counted all of them as undiscovered. Words
 * stay out of the firmament, as they always have: twelve thousand of them
 * would be the whole sky. */
export function beyondWords(history: HistoryFile, now = Date.now()): { items: SkyItem[]; met: string[]; firmament: string[] } {
  // only these picks and what is under them are wanted, so the sky is not
  // built first (it was, and was half the home's payload time, SAK-382)
  const o = offerPicker(history, now);
  const met: string[] = [];
  const firmament: string[] = [];
  for (const kind of [COUNTER_KIND, GRAMMAR_SUBJECT, SENTENCE_RULE_KIND, TRANSITIVITY_SUBJECT, KEIGO_SUBJECT] as const) {
    for (const entry of LIB_ENTRIES_BY_KIND.get(kind) ?? []) {
      if (!o.offerPick(entry.id)) continue;
      (standingFor(entry, history, now).met ? met : firmament).push(entry.id);
    }
  }
  // the picks and everything under them, so their constellations are whole
  const keep = new Set<string>();
  const walk = (id: string) => { if (keep.has(id)) return; keep.add(id); for (const c of o.items.get(id)?.components ?? []) walk(c); };
  [...met, ...firmament].forEach(walk);
  return { items: [...keep].map((id) => o.items.get(id)).filter((x): x is SkyItem => !!x), met, firmament };
}

/** The facts a set of picks claims when the learner says "I already know
 * these": each pick claims only itself (Sam's rule: a claimed word says
 * nothing about its kanji), and a kana row claims its sounds. */
export function pickFacts(ids: readonly string[]): FactId[] {
  const out: FactId[] = [];
  for (const id of ids) {
    if (id === TSU_RULE) {
      for (const f of COUNTER_CURRICULUM) if (f.counter === "つ") { const e = libEntry(counterEntry(f)); if (e) out.push(...knownFactsOf(e)); }
      continue;
    }
    const row = /^kana-row:(.+)$/.exec(id);
    if (row) {
      const section = SETS.flatMap((set) => set.sections).find((s) => s.id === row[1]);
      for (const ch of section?.chars ?? []) { const e = libEntry(kanaEntry(ch.c)); if (e) out.push(...knownFactsOf(e)); }
      continue;
    }
    const entry = libEntry(id as Parameters<typeof libEntry>[0]);
    if (entry) out.push(...knownFactsOf(entry));
  }
  return out;
}
