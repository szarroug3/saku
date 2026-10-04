// What a word means, cut short enough to print under it (SAK-506). The
// sentence quiz gives the meanings of the pieces of a sentence this way, and the grammar
// page's words line under its sentence does too, so the two say a word's
// meaning the same way.
//
// A sentence's words come from the tokenizer as lemmas, and a lemma is not
// always a word the vocabulary files under that spelling. `wordInSentence`
// finds the vocabulary's word for one and the sense the sentence uses
// (SAK-508, SAK-514):
//
// - A kana lemma that a vocabulary word with kanji also reads, where the
//   sentence writes that kanji, is that word: かく is 書く in a sentence with 書.
// - A verb in potential form is its dictionary verb: 泳げる is 泳ぐ, 行ける is
//   行く. The tokenizer files a godan verb's potential as a verb of its own.
// - A kana lemma that several vocabulary words read as is the one the English
//   names, tried in order of how often CEJC hears each, and otherwise the word
//   written in kana (SAK-519): せい is "blame" in "I'm to blame".
// - A kana verb whose own meaning is a rare word of the same sound means the
//   helper verb first (SAK-519): なる is 成る "to become" and not 生る "to
//   bear fruit", and いる is 居る "to be" and not 要る "to be needed".
// - The sense is the first one the sentence's English says, then the first
//   the pattern's gloss says, then the word's first. 休みたい is "I want
//   to rest", so 休む is "to rest", where its first sense is "to be absent".
//
// Before any of that, the lookup takes a meaning written for the word in
// this very sentence (SAK-516). The table is src/data/grammar/sentence-word-meanings.ts,
// keyed by the corpus sentence's id: ため is "in order to" in
// それをするためには危険を冒さなければならない, where the rules say
// "good". A caller that names the sentence by its id gets the row. The quiz
// and the pattern page's words line both do, so they say the same thing.

import { conjugate } from "@/lib/conjugate";
import { entryForGlyph, libEntry, type LibEntry } from "@/lib/library/entries";
import { wordClassOf } from "@/lib/word-forms";
import { readingDefinitions, readingFrequency, VOCAB_SUBJECT, vocabRow, vocabRowsBySpelling, type ReadingDefinition, type VocabRow } from "@/data/vocab";
import { SENTENCE_WORD_MEANINGS } from "@/data/grammar/sentence-word-meanings";

/** The vocabulary's entry for a word as written, or nothing when the
 * vocabulary does not have it. */
function vocabEntryOf(word: string | null): LibEntry | undefined {
  const id = word ? entryForGlyph(VOCAB_SUBJECT, word) : undefined;
  return id ? libEntry(id) : undefined;
}

/** A dictionary sense without its asides, up to its first semicolon: "water",
 * not "water (esp. cool or cold)". Nothing when that leaves nothing. */
function shortMeaning(meaning: string | undefined): string | undefined {
  return meaning?.replace(/\s*\([^)]*\)/g, "").split(";")[0].trim() || undefined;
}

/** The sentence a word is read in: its id in the grammar corpus when it is
 * one of its sentences, its Japanese, its English, and the gloss of the
 * pattern it is shown for ("thanks to X"), when there is one. */
interface SentenceContext {
  readonly id?: number;
  readonly jp: string;
  readonly en: string;
  readonly gloss?: string;
}

/** A sentence's word: the word to print (泳ぐ for the 泳げる of 泳げない),
 * its vocabulary entry, and the meaning it has in the sentence. A word with a
 * meaning written for its sentence may have no entry (鞍), and has the
 * row's reading for its furigana when it has kanji. */
interface WordInSentence {
  readonly word: string;
  readonly entry?: LibEntry;
  readonly reading?: string;
  readonly meaning: string;
}

/** The vocabulary's word for a lemma in a sentence, and what it means there.
 * A meaning written for the word in this sentence comes first. Otherwise,
 * nothing when the vocabulary has no word for it, or files it only as a
 * particle (もの). */
export function wordInSentence(lemma: string, sentence: SentenceContext): WordInSentence | undefined {
  const own = sentence.id === undefined ? undefined : SENTENCE_WORD_MEANINGS[String(sentence.id)]?.[lemma];
  if (own) {
    const entry = vocabEntryOf(lemma);
    return { word: lemma, ...(entry ? { entry } : {}), ...(own.reading ? { reading: own.reading } : {}), meaning: own.meaning };
  }
  const found = headwordOf(lemma, sentence);
  if (!found) return undefined;
  const entry = vocabEntryOf(found.row.keb);
  if (!entry || found.row.pos.every((p) => p === "particle")) return undefined;
  const meaning = senseIn(found.row, entry, sentence);
  return meaning ? { word: found.word, entry, meaning } : undefined;
}

const KANJI = /[㐀-鿿々]/g;
const isKana = (s: string) => /^[ぁ-ゟ゠-ヿ]+$/.test(s);

/** Which vocabulary row a lemma is, and the word to print for it. */
function headwordOf(lemma: string, sentence: SentenceContext): { word: string; row: VocabRow } | undefined {
  const { jp } = sentence;
  if (isKana(lemma)) {
    // a word read this way whose kanji the sentence writes: 書く for かく
    // where the sentence has 書
    const written = vocabRowsBySpelling(lemma).find((r) => r.reb === lemma && r.keb !== lemma && r.keb.match(KANJI)?.every((k) => jp.includes(k)));
    if (written) return { word: written.keb, row: written };
  }
  const own = isKana(lemma) ? kanaWordOf(lemma, sentence) : vocabRow(lemma);
  if (own) return { word: own.keb, row: own };
  const dictionary = potentialOf(lemma);
  return dictionary ? { word: dictionary.keb, row: dictionary } : undefined;
}

/** Which of the vocabulary's words a kana lemma is (SAK-519), when more than
 * one is read that way. The first, by how often CEJC hears each one read this
 * way, whose sense the sentence's English names: せい is "blame" in "Do you
 * think I'm to blame?", and 性 "nature" is not. With none named, the word
 * written in kana, as before. */
function kanaWordOf(lemma: string, sentence: SentenceContext): VocabRow | undefined {
  const kana = vocabRow(lemma);
  const rows = vocabRowsBySpelling(lemma);
  if (rows.length < 2) return kana;
  const heard = (r: VocabRow) => readingFrequency(r.keb, lemma);
  const byUse = [...(kana ? [kana] : []), ...rows.filter((r) => r !== kana)].sort((a, b) => heard(b) - heard(a));
  const named = byUse.find((r) => {
    const entry = vocabEntryOf(r.keb);
    return entry && sensesOf(r, entry).some((m) => says(sentence.en, m));
  });
  return named ?? kana;
}

/** The ending of a godan verb's potential, back to the dictionary ending. */
const U_OF_E: Readonly<Record<string, string>> = { え: "う", け: "く", げ: "ぐ", せ: "す", て: "つ", ね: "ぬ", べ: "ぶ", め: "む", れ: "る" };

/** The godan verb whose potential form a lemma is (SAK-514): 泳げる is 泳ぐ's,
 * 行ける is 行く's. The e-row kana before the final る goes back to the u-row,
 * and the verb found that way must give the lemma back when the conjugation
 * engine makes its potential. An ichidan verb's potential (食べられる) is
 * never a lemma, since the tokenizer splits off its られる.
 *
 * A verb of its own that looks like a potential is not folded. 付ける has the
 * shape of 付く's potential, but it is the verb "to attach", which the
 * vocabulary files in kana as つける. So when the potential's reading is a
 * word the vocabulary writes in kana, the lemma is that word and not a form.
 * A lemma in kana folds only to a verb the vocabulary writes in kana
 * (もらえる to もらう): ぬれる is "to get wet", and 塗る, which reads ぬる,
 * is another word. */
function potentialOf(lemma: string): VocabRow | undefined {
  const u = lemma.endsWith("る") ? U_OF_E[lemma.at(-2) ?? ""] : undefined;
  if (!u) return undefined;
  const verb = lemma.slice(0, -2) + u;
  const rows = isKana(lemma) ? [vocabRow(verb)].filter((r): r is VocabRow => !!r) : [vocabRow(verb), ...vocabRowsBySpelling(verb)].filter((r): r is VocabRow => !!r);
  return rows.find((r) => {
    const cls = wordClassOf(r);
    if (!cls?.startsWith("v5")) return false;
    const potential = (w: string) => {
      const made = conjugate(w, cls, "potential");
      return made.ok ? made.value : undefined;
    };
    if (potential(r.keb) !== lemma && potential(r.reb) !== lemma) return false;
    const said = potential(r.reb);
    return !said || !vocabRowsBySpelling(said).some((w) => w.keb === w.reb);
  });
}

/** Which of a word's senses the sentence uses, cut short. The first one the
 * English says wins (休む is "to rest" in "I want to rest"), then the first the
 * pattern's gloss says, then the word's first meaning. */
function senseIn(row: VocabRow, entry: LibEntry, sentence: SentenceContext): string | undefined {
  const offered = sensesOf(row, entry);
  const gloss = sentence.gloss;
  return offered.find((m) => says(sentence.en, m)) ?? (gloss ? offered.find((m) => says(gloss, m)) : undefined) ?? offered[0];
}

/** A word's senses, cut short, in the order they are tried. Each of the
 * dictionary's senses offers its first gloss, and the first sense offers all
 * of its glosses (話す is "to talk" first, and "to speak" is its second
 * gloss). The word's own meaning, as the vocabulary teaches it, comes first,
 * except for a word in kana whose own meaning is a rare word with the same
 * sound (SAK-519): see `helperWordOf`. */
function sensesOf(row: VocabRow, entry: LibEntry): string[] {
  const defs = readingDefinitions(row).filter((d) => d.glosses.length && d.glosses[0] !== "null");
  const helper = helperWordOf(row, defs);
  const ordered = helper ? [...defs.filter((d) => wordOfSense(d) === helper), ...defs.filter((d) => wordOfSense(d) !== helper)] : defs;
  const senses = ordered.map((d) => d.glosses);
  const short = (glosses: readonly string[]) => glosses.map(shortMeaning).filter((m): m is string => !!m);
  const later = short(senses.slice(1).map((g) => g[0])).filter((m) => !LIGHT.has(m.replace(/^to /, "")));
  if (!helper) return [...short(entry.meanings), ...short(senses[0] ?? []), ...later];
  // the word's own meaning still offers all its glosses, so "If you want a
  // pencil" finds いる's "to want"
  const own = defs.find((d) => d.glosses[0] === row.glosses[0])?.glosses ?? [];
  return [...short(senses[0] ?? []), ...later, ...short(entry.meanings), ...short(own)];
}

/** Which dictionary word a sense belongs to: JMdict's entry number, the part
 * of the sense's id before the colon. */
const wordOfSense = (d: ReadingDefinition) => d.id.split(":")[0];

/** The dictionary word a kana verb means first when its own meaning is a
 * rare word that happens to sound the same (SAK-519). The vocabulary's なる
 * is 生る "to bear fruit", one sense long, and the same kana is also 成る "to
 * become", which is a verb of its own and a helper verb besides (〜になる,
 * 〜ことになる). いる is 要る "to be needed", and also 居る "to be", the いる of
 * 〜ている. A helper verb is among the words said most, so its word comes
 * first. Only a verb whose own meaning has one sense, and only a word whose
 * first sense is a verb in its own right and not the helper use (とる's
 * "to be ...-ing" is never anyone's first guess). This is 成る and 居る. */
function helperWordOf(row: VocabRow, defs: readonly ReadingDefinition[]): string | undefined {
  if (row.keb !== row.reb || !row.pos.some((p) => /^(Godan|Ichidan) verb/.test(p))) return undefined;
  const own = defs.find((d) => d.glosses[0] === row.glosses[0]);
  if (!own || defs.filter((d) => wordOfSense(d) === wordOfSense(own)).length > 1) return undefined;
  const helper = defs.find((d) => wordOfSense(d) !== wordOfSense(own) && d.readings.some((s) => s.pos.some((p) => p.includes("auxiliary verb"))));
  if (!helper) return undefined;
  const first = defs.find((d) => wordOfSense(d) === wordOfSense(helper))!;
  return first !== helper && /^to /.test(first.glosses[0]) && !first.glosses[0].includes("...") ? wordOfSense(helper) : undefined;
}

/** English words too common to pick out a later sense by. する's later
 * senses include "to wear" and "to be", and an English line that says
 * "wearing" or "be" is not using them. A word's first sense may still be one
 * of these (する is "to do"). */
const LIGHT: ReadonlySet<string> = new Set(["be", "do", "have", "get", "make", "go", "give", "take", "put", "come", "wear"]);

/** Whether a line of English uses a meaning's word: "rest" is in "I want to
 * rest", "lack" in "she lacked". A leading "to" does not count. */
function says(en: string, meaning: string): boolean {
  const core = meaning.replace(/^to /, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return core.length > 1 && new RegExp(`\\b${core}(?:s|es|d|ed|ing)?\\b`, "i").test(en);
}
