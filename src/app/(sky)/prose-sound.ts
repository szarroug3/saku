// Readings for the Japanese written inside the teaching's prose (SAK-484).
//
// A page of teaching is English with Japanese in it: "食べる and 飲む happen
// to something", "猫は好きです is about cats". Each stretch of Japanese with a
// kanji in it (a run, split by `kanjiRunsIn` in src/sky/lib/sound-line.ts) is
// given its readings by one of two readers, and a run neither can answer for
// is printed as it was.
//
//   - Grammar prose (a particle's page, a pattern's page, a sentence type's
//     walk, the Family table) reads a run as a word first, from the
//     vocabulary, the way a kanji card's words are read (`wordSound`, SAK-482);
//     and a run that is not one word (猫は好きです, 行くから) from the readings
//     pass, the same file the "In a sentence" block reads
//     (src/data/sentence-readings.ts). scripts/build-sentence-readings.ts
//     lists every such run for the pass with `runsForReadingsPass`, so the
//     two agree on which runs the pass has to read.
//   - A term's page (Radical, Okurigana, 々, Keiyōshi) is authored copy about
//     how words are read, and a reading taken from somewhere else can be the
//     wrong one for the point the page makes (人 counting people is にん, not
//     the ひと the vocabulary gives it). So those pages carry their readings
//     beside the text they belong to: `readings` on a card (PhaseIntro) or a
//     term, one whole reading per run, split over its kanji by
//     `rubyFromReading`. A run written with no reading (null) is a shape and
//     not a word (氵, 々 on its own) and prints plain on purpose.

import { sentenceRuby } from "@/data/sentence-readings";
import { vocabRow } from "@/data/vocab";
import { piecesOf } from "@/lib/library/word-pieces";
import type { SoundLine } from "@/sky/lib/lesson";
import { cutLine, kanjiRunsIn, rubyFromReading, rubyProse } from "@/sky/lib/sound-line";

/** What gives a run of Japanese its readings, or nothing when it has none. */
export type RunReader = (run: string) => SoundLine | undefined;

/** Readings written beside authored copy: a run as it appears in the text, and
 * its whole reading in kana, or null for a run printed plain on purpose. */
type AuthoredReadings = Readonly<Record<string, string | null>>;

/** A word with its furigana (SAK-482): each kanji with its own reading in
 * this word (休日 is きゅう over 休 and じつ over 日), and the kana as they
 * are. A word that does not split by kanji (大人 is おとな, not 大 plus 人)
 * carries its reading over the whole word, and a word the vocabulary does not
 * have prints plain. */
export function wordSound(word: string): SoundLine {
  const row = vocabRow(word);
  if (!row) return [{ text: word }];
  const pieces = piecesOf(row);
  if (!pieces) return row.reb === word ? [{ text: word }] : [{ text: word, ruby: row.reb }];
  return pieces.map((p) => (p.kind === "kanji" ? { text: p.written, ruby: p.reading } : { text: p.text }));
}

/** A run that is one word the vocabulary has, with its readings. */
function vocabSound(run: string): SoundLine | undefined {
  if (!vocabRow(run)) return undefined;
  const sound = wordSound(run);
  return sound.some((s) => s.ruby) ? sound : undefined;
}

/** Grammar prose: a word from the vocabulary, else the readings pass. */
export const proseReader: RunReader = (run) => vocabSound(run) ?? sentenceRuby(run);

/** The runs of a line of grammar prose that the readings pass has to read:
 * every run with a kanji in it that is not a word the vocabulary reads. */
export function runsForReadingsPass(text: string): string[] {
  return kanjiRunsIn(text).filter((run) => !vocabSound(run));
}

/** Authored copy: the reading written for the run. A run with none written
 * goes to `otherwise` (a grammar card that is also read as grammar prose), and
 * a run written as null stays plain whatever `otherwise` would say. */
export function authoredReader(readings: AuthoredReadings, otherwise?: RunReader): RunReader {
  return (run) => {
    if (!Object.hasOwn(readings, run)) return otherwise?.(run);
    const reading = readings[run];
    return reading ? rubyFromReading(run, reading) : undefined;
  };
}

/** A line of prose as runs with the readings over its Japanese, and `accent`,
 * a phrase of it, picked out the way the page picks it out in plain text. */
export function proseSound(text: string, read: RunReader, accent?: string): SoundLine {
  const line = rubyProse(text, read);
  const at = accent ? text.indexOf(accent) : -1;
  if (!accent || at < 0) return line;
  const [before, mark, after] = cutLine(line, at, at + accent.length);
  return [...before, ...mark.map((r) => ({ ...r, accent: true })), ...after];
}
