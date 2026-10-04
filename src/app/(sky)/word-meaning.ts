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
// - The sense is the first one the sentence's English says, then the first
//   the pattern's gloss says, then the word's first. 休みたい is "I want
//   to rest", so 休む is "to rest", where its first sense is "to be absent".
//
// Before any of that, the lookup takes a meaning written for the word in
// this very sentence (SAK-516). The table is src/data/grammar/sentence-word-meanings.ts,
// keyed by the corpus sentence's id: なる is "to become" in
// コンピューターのおかげで人間は馬鹿になる, where the rules say "to bear
// fruit". A caller that names the sentence by its id gets the row, so the
// quiz and the pattern page's words line say the same thing.

import { conjugate } from "@/lib/conjugate";
import { entryForGlyph, libEntry, type LibEntry } from "@/lib/library/entries";
import { wordClassOf } from "@/lib/word-forms";
import { readingDefinitions, VOCAB_SUBJECT, vocabRow, vocabRowsBySpelling, type VocabRow } from "@/data/vocab";
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
  const found = headwordOf(lemma, sentence.jp);
  if (!found) return undefined;
  const entry = vocabEntryOf(found.row.keb);
  if (!entry || found.row.pos.every((p) => p === "particle")) return undefined;
  const meaning = senseIn(found.row, entry, sentence);
  return meaning ? { word: found.word, entry, meaning } : undefined;
}

const KANJI = /[㐀-鿿々]/g;
const isKana = (s: string) => /^[ぁ-ゟ゠-ヿ]+$/.test(s);

/** Which vocabulary row a lemma is, and the word to print for it. */
function headwordOf(lemma: string, jp: string): { word: string; row: VocabRow } | undefined {
  if (isKana(lemma)) {
    // a word read this way whose kanji the sentence writes: 書く for かく
    // where the sentence has 書
    const written = vocabRowsBySpelling(lemma).find((r) => r.reb === lemma && r.keb !== lemma && r.keb.match(KANJI)?.every((k) => jp.includes(k)));
    if (written) return { word: written.keb, row: written };
  }
  const own = vocabRow(lemma);
  if (own) return { word: lemma, row: own };
  const dictionary = potentialOf(lemma);
  return dictionary ? { word: dictionary.keb, row: dictionary } : undefined;
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

/** Which of a word's senses the sentence uses, cut short. Each of the
 * dictionary's senses offers its first gloss, and the first sense offers all
 * of its glosses (話す is "to talk" first, and "to speak" is its second
 * gloss). The first one the English says wins (休む is "to rest" in "I want to
 * rest"), then the first the pattern's gloss says, then the word's first
 * meaning as the vocabulary teaches it. */
function senseIn(row: VocabRow, entry: LibEntry, sentence: SentenceContext): string | undefined {
  const senses = readingDefinitions(row)
    .map((d) => d.glosses)
    .filter((g) => g.length && g[0] !== "null");
  const short = (glosses: readonly string[]) => glosses.map(shortMeaning).filter((m): m is string => !!m);
  const later = short(senses.slice(1).map((g) => g[0])).filter((m) => !LIGHT.has(m.replace(/^to /, "")));
  const offered = [...short(entry.meanings), ...short(senses[0] ?? []), ...later];
  const gloss = sentence.gloss;
  return offered.find((m) => says(sentence.en, m)) ?? (gloss ? offered.find((m) => says(gloss, m)) : undefined) ?? offered[0];
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
