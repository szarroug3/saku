// What the reveal explains: which reading applies here, and why (SAK-316).
// Server-side, like the adapters beside it; the Sky renders what this hands
// it and never reads the tables itself.
//
// The quiz is mostly NOT asking what something means. It is asking which
// reading applies, because that is the part of Japanese that actually goes
// wrong: 水 is みず alone and すい in 水曜日. So the reveal's job is to explain
// the rule, not to confirm the answer a second time.
//
// THE PROSE IS AUTHORED PER RULE, NOT PER ITEM. On'yomi against kun'yomi,
// rendaku voicing, the small つ, the two sets of numbers. Written once here
// and attached to the pattern, so every card that exercises the rule reuses
// the same wording and the learner meets one explanation over and over rather
// than a hundred near misses. The character and the word are filled in; the
// sentences are not rewritten per card.
//
// A card whose rule this file cannot name honestly gets none, and the reveal
// then shows what it always showed. That is the same bargain as SAK-315's
// distractor lines: silence beats an invented explanation.

import { SETS } from "@/data/characters";
import { isConstructionFact } from "@/data/counter-categories";
import { READING_INDEX, type ReadingRow } from "@/data/kanji";
import { markEntry, markFor } from "@/data/marks";
import type { QuizReading, QuizRule } from "@/sky/lib/quiz";
import type { SkyItem } from "@/sky/lib/types";
import type { FactId } from "@/types";

/** The most readings the breakdown lists: the one asked, then the
 * best-attested others. A character with eleven of them teaches nothing by
 * printing all eleven. */
const MOST_READINGS = 6;

/** Every reading a character has, by character, built once. The index is
 * keyed by fact, and the breakdown wants the other facts of the same
 * character, which is a scan of 3,496 rows per card otherwise. */
let byKanji: Map<string, ReadingRow[]> | undefined;
function readingsOf(k: string): readonly ReadingRow[] {
  if (!byKanji) {
    byKanji = new Map();
    for (const row of READING_INDEX.values()) {
      const rows = byKanji.get(row.k);
      if (rows) rows.push(row);
      else byKanji.set(row.k, [row]);
    }
  }
  return byKanji.get(k) ?? [];
}

/** The dictionary's word for a reading's type, as a line says it. */
const KIND: Record<string, string> = { on: "on'yomi", kun: "kun'yomi", both: "listed both ways" };

/** The character's readings, the asked one marked, best attested first.
 *
 * This is the breakdown the card asks for: the reading that applies is not
 * interesting on its own, it is interesting against the ones that did not.
 * Deduped by reading, since one reading can be anchored in several words and
 * the same sound twice on a list is not a contrast. */
function breakdown(asked: ReadingRow): QuizReading[] {
  const rows = readingsOf(asked.k);
  const seen = new Set<string>([asked.base]);
  const others: ReadingRow[] = [];
  for (const r of [...rows].sort((a, b) => b.nWords - a.nWords)) {
    if (seen.has(r.base)) continue;
    seen.add(r.base);
    others.push(r);
  }
  return [asked, ...others].slice(0, MOST_READINGS).map((r) => ({
    reading: r.base,
    ...(r.type ? { kind: KIND[r.type] } : {}),
    inWord: r.anchor,
    applies: r === asked,
  }));
}

/**
 * THE LONG VOWELS, AND WHY THEY NEED A SENTENCE (SAK-316, SAK-432).
 *
 * A vowel held for two beats is one sound, and Japanese writes it by putting a
 * second kana after the kana that carries it. Which second kana is the part
 * that catches people out, because for two of the five vowels there are two
 * spellings of the one sound: a long お is written with う in almost every word
 * (とう, こう, しょう) and with お in a handful (とおい, おおきい), and a long え
 * is written with い almost always (せい, えい) and with え in a few (ねえ).
 * Long う and long い just double, with nothing to confuse them with.
 *
 * THE PAIR IS THE VOWEL'S, NOT THE SPELLING'S. It is not the literal おう:
 * こう and とう and しょう are all the same long お, and a rule looking for the
 * characters お then う would miss every one of them. So this reads the VOWEL
 * each kana ends on, out of the kana tables the app already teaches from, and
 * asks whether the kana after it is one of the two that hold that vowel.
 */
const LONG_VOWEL_PAGE = markFor(markEntry("long-vowel"))?.name ?? "Chōon";

/** Which kana can hold each vowel for a second beat, commonest spelling first.
 * A vowel with two of them has two spellings of one sound; one with a single
 * entry has only itself doubled. あ is not here: ああ is rare enough in the
 * readings this quizzes that a sentence about it would be a sentence about
 * nothing. */
const HOLDS: Record<string, readonly string[]> = {
  o: ["う", "お"],
  e: ["い", "え"],
  u: ["う"],
  i: ["い"],
};

/** The vowel itself, to name the sound being held: "a long お". */
const VOWEL_KANA: Record<string, string> = { o: "お", e: "え", u: "う", i: "い" };

/** The vowel a kana ends on: か is a, ん is none, and the small ゅ of ちゅう
 * is u. Read off the kana tables rather than restated, so a kana and its vowel
 * cannot drift apart.
 *
 * Keyed by the LAST character of each entry, which is what makes the small
 * kana fall out for free: the tables hold きゅ as one entry read "kyu", and the
 * last of those two characters is the one carrying the u. A reading is walked
 * character by character, so ちゅう has to be able to ask about ゅ on its own. */
let vowels: Map<string, string> | undefined;
function vowelOf(kana: string): string | undefined {
  if (!vowels) {
    vowels = new Map();
    for (const set of SETS) for (const section of set.sections) for (const ch of section.chars) {
      const last = (ch.r[0] ?? "").slice(-1);
      const tail = [...ch.c].pop();
      if (tail && "aiueo".includes(last)) vowels.set(tail, last);
    }
  }
  return vowels.get(kana);
}

/**
 * The long-vowel sentence for a reading that holds one, or nothing.
 *
 * THE FIRST ONE ONLY. A kanji reading is a syllable or two and holds one of
 * these at most; a sentence per run would turn a rule into a list.
 */
function longVowelNote(base: string): string {
  const kana = [...base];
  for (let i = 0; i < kana.length - 1; i++) {
    const vowel = vowelOf(kana[i]);
    const holds = vowel ? HOLDS[vowel] : undefined;
    if (!holds) continue;
    const here = kana[i + 1];
    if (!holds.includes(here)) continue;
    const there = holds.find((k) => k !== here);
    const long = `a long ${VOWEL_KANA[vowel as string]}`;
    return there
      ? ` ${base} holds ${long}, written with ${here} here and with ${there} in the other spelling of the same sound, and the Atlas's ${LONG_VOWEL_PAGE} page sets the two out.`
      : ` ${base} holds ${long}: the ${here} is the kana before it held for another beat rather than a sound of its own, and the Atlas's ${LONG_VOWEL_PAGE} page sets that out.`;
  }
  return "";
}

/** What happens to the reading inside THIS word, when something does.
 *
 * The reading index folds rendaku and gemination into one reading on purpose:
 * 出口's ぐち is くち voiced, and scoring the two apart would split one piece
 * of knowledge in two. So the surface differing from the base is never a
 * different reading, and the sentence says so. Every difference in the tables
 * is one of these two, and nothing else. */
function surfaceNote(row: ReadingRow): string {
  if (row.surface === row.base) return "";
  if (row.surface.endsWith("っ")) {
    return ` Inside ${row.anchor} it clips short, ${row.base} to ${row.surface}, to sit against the sound that follows. It counts as the same reading.`;
  }
  return ` Inside ${row.anchor} it voices, ${row.base} to ${row.surface}. A part joined onto the back of a word often softens its first sound like that. It counts as the same reading.`;
}

/** The reading rule for a kanji reading fact.
 *
 * Two sentences can follow the rule's own: what happens to the sound inside
 * this word, and, when the reading holds a vowel, which two spellings that one
 * sound has. Both are about the reading the card just asked for, so both go
 * after the rule rather than in front of it. */
function kanjiReadingRule(row: ReadingRow): QuizRule {
  const rest = `${surfaceNote(row)}${longVowelNote(row.base)}`;
  const readings = breakdown(row);
  if (row.type === "kun") {
    return {
      title: "Kun'yomi: the native reading",
      // NOT "the character standing alone", flatly: 一 is ひと in 一人, which
      // is a compound and still native. Kun'yomi go with native words, and
      // that is the line the sentence has to draw.
      prose: `${row.base} is a kun'yomi, the native Japanese word ${row.k} was assigned to. A kun'yomi is what the character takes standing alone, carrying okurigana after it, or inside a word built out of native words. Joined into a borrowed compound it usually swaps to an on'yomi instead. Same character, and the company it keeps decides.${rest}`,
      readings,
    };
  }
  if (row.type === "both") {
    return {
      title: "Filed both ways",
      prose: `The dictionary files ${row.base} as an on'yomi and as a kun'yomi, for different senses, so there is no rule to lean on here. Twenty readings in the whole set are like this one. It is learned word by word.${rest}`,
      readings,
    };
  }
  return {
    title: "On'yomi: the borrowed reading",
    prose: `${row.base} is an on'yomi, a pronunciation borrowed from Chinese along with the character. An on'yomi is what ${row.k} usually takes once it is joined to other kanji. Standing alone as a word it takes a kun'yomi instead. Same character, and the company it keeps decides.${rest}`,
    readings,
  };
}

/** The two sets of numbers, which is the other place a reading is chosen by
 * rule rather than remembered per word. */
const NUMBERS: QuizRule = {
  title: "Japanese counts twice over",
  prose: "ひとつ, ふたつ, みっつ are the native numbers. いち, に, さん are the ones borrowed from Chinese, and they are what almost every counter takes. Which set a counter wants belongs to the counter itself, so it is learned along with it rather than worked out.",
};

/** The rule a card exercises, or nothing when there is none to name.
 *
 * Nothing, deliberately, for a meaning card: what a character means is not a
 * question about which reading applies, and a rule attached to it would be a
 * rule about the wrong thing.
 *
 * Long vowels DO get a sentence now (SAK-432), and it hangs off the reading
 * rather than off a flag in the tables: the reading itself says whether it
 * holds one, because holding one is what おう and おお and えい ARE.
 */
export function readingRuleFor(fact: FactId, item: SkyItem): QuizRule | undefined {
  const row = READING_INDEX.get(fact);
  if (row) return kanjiReadingRule(row);
  if (isConstructionFact(fact)) return NUMBERS;
  if (item.kind === "counter" && (fact as string).includes("/reading")) return NUMBERS;
  return undefined;
}
