// The furigana over a lesson's example sentences: the kana each kanji says in
// the sentence a lesson's "In a sentence" block shows.
//
// Generated in two passes, the same shape word-examples.json has:
// scripts/build-sentence-readings.ts lists every sentence the block can show,
// and scripts/ingest/teach_sentence_readings.py reads each one with the
// tokenizer and aligner the word pages' sentences are read with (SAK-95). One
// slot per kanji in the sentence, left to right, each the same
// [kanji, reading-here, base-reading] triple as word-examples.ts's
// KanjiReadingSlot, or null where the reading could not be worked out
// (今日, 明日, 部屋: a reading that belongs to the word, not its kanji). A null
// slot prints as plain kanji: no reading beats a wrong one.

import readingsJson from "./generated/sentence-readings.json" with { type: "json" };
import type { KanjiReadingSlot } from "./word-examples";

const READINGS = readingsJson as unknown as Readonly<Record<string, readonly KanjiReadingSlot[]>>;

/** A kanji as the readings pass counts one (aligner.is_kanji): the CJK blocks
 * and the iteration mark 々, which takes a slot of its own. */
const isKanji = (ch: string) => {
  const cp = ch.codePointAt(0) ?? 0;
  return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || cp === 0x3005;
};

/** Whether a sentence has a row: the test's check that every sentence the
 * block can show was run through both passes. */
export function hasSentenceReadings(jp: string): boolean {
  return jp in READINGS;
}

/** A stretch of a sentence as runs, each run of kanji carrying its reading.
 *
 * `from`/`to` pick out part of `jp` (a sentence part the page labels, "Topic"
 * over 私は), so a sentence split into parts gets its readings part by part and
 * the parts still join up into the sentence. Each kanji carries its own
 * reading (学 がく, 生 せい) rather than one reading over a run of them: a run
 * of kanji is not a word (一晩泊めて is 一晩 and 泊めて, and ひとばんと over all
 * three reads as one word), and the slots say what each kanji says, not where
 * a word ends. Undefined when the sentence has no row,
 * or its row does not match its kanji, which leaves the caller printing it
 * plain. */
export function sentenceRuby(jp: string, from = 0, to = jp.length): Array<{ text: string; ruby?: string }> | undefined {
  const slots = READINGS[jp];
  if (!slots) return undefined;
  // by UTF-16 unit, the unit a span into `jp` counts in
  const chars = jp.split("");
  // the reading of each kanji, by its position in the sentence
  const reading: Array<string | null> = [];
  let n = 0;
  for (const ch of chars) reading.push(isKanji(ch) ? slots[n++]?.[1] ?? null : null);
  if (n !== slots.length) return undefined;

  const runs: Array<{ text: string; ruby?: string }> = [];
  const plain = (text: string) => {
    const last = runs[runs.length - 1];
    if (last && last.ruby === undefined) last.text += text;
    else runs.push({ text });
  };
  for (let i = from; i < to; i++) {
    const r = reading[i];
    if (r) runs.push({ text: chars[i], ruby: r });
    else plain(chars[i]);
  }
  return runs;
}
