// The reader (#BuildHybridAI): Japanese the learner brings, pasted or from a
// web page, shown word by word in the colors of what they know. A word Saku
// teaches opens its card; any stretch of the text can be translated or asked
// about.
//
// This file is the shape of a text once it is read and the passage text the
// models get. The splitting and the matching are on the server
// (src/app/(sky)/reader.ts), since the dictionary and the library are far too
// big for the browser.

import type { Standing } from "@/sky/lib/standing";

/** A kanji in a word Saku doesn't teach, so the learner can still open it. */
export interface ReadKanji {
  id: string;
  glyph: string;
  standing: Standing;
}

export interface ReadWord {
  /** The word as it is written in the text. */
  text: string;
  /** Its reading in hiragana, when it has kanji. */
  reading?: string;
  /** Its dictionary form, when that differs: 見る for 見. */
  base?: string;
  /** The Saku entry it is, and where the learner stands with it. */
  entry?: string;
  standing?: Standing;
  /** For a word Saku doesn't teach: the kanji in it that Saku does. */
  kanji?: readonly ReadKanji[];
  /** Punctuation, a space or anything else that isn't a word. */
  mark?: true;
}

export interface ReadText {
  /** The page's title, for a text from the web. */
  title?: string;
  /** Where it came from, for a text from the web. */
  source?: string;
  paragraphs: readonly (readonly ReadWord[])[];
  /** The text was longer than READ_MAX and only its start was read. */
  cut?: true;
}

/** The longest text the reader takes, in characters. A long article is
 * around 5,000. */
export const READ_MAX = 12_000;

/** The text back as one string, a paragraph to a line. */
export function plainText(text: ReadText): string {
  return text.paragraphs.map((p) => p.map((w) => w.text).join("")).join("\n");
}

/** How much of the text goes in a prompt around a selection. Nano's window
 * is small. */
const AROUND = 600;

/** The passage a question about `selected` is asked against: the paragraph
 * it is in, or the text near it, cut to fit a prompt. */
export function passageAround(text: ReadText, selected: string): string {
  const whole = plainText(text);
  const at = whole.indexOf(selected);
  if (at < 0) return whole.slice(0, AROUND * 2);
  const start = Math.max(0, at - AROUND);
  return whole.slice(start, at + selected.length + AROUND);
}

/** Whether clicking the word opens anything: its card, or its kanji. */
export function hasCard(w: ReadWord): boolean {
  return !!w.entry || !!w.kanji?.length;
}
