// A line of runs cut at a span, so one stretch of it can be drawn apart from
// the rest (SAK-481): the word a word card's sentence underlines, the particle
// the Particle table picks out. Once a sentence carries furigana it is runs,
// not a string, and the span still counts in characters of the sentence.

import type { SoundLine } from "./lesson";

type Run = SoundLine[number];

/** The line as three lines: before `from`, from `from` up to `to`, and after.
 *
 * A plain run is split where the span cuts it. A run with a reading over it is
 * never split, since half a reading over half a word is wrong: it goes whole to
 * the part its first character falls in. Each kanji carries its own reading,
 * so that only happens to a jukujikun (今日 きょう) cut down the middle, and
 * a span that picks out a word never does that. */
export function cutLine(line: SoundLine, from: number, to: number): [Run[], Run[], Run[]] {
  const parts: [Run[], Run[], Run[]] = [[], [], []];
  const part = (at: number) => (at < from ? 0 : at < to ? 1 : 2);
  let at = 0;
  for (const run of line) {
    const end = at + run.text.length;
    if (run.ruby !== undefined) parts[part(at)].push(run);
    else {
      for (const [a, b] of [[at, Math.min(end, from)], [Math.max(at, from), Math.min(end, to)], [Math.max(at, to), end]] as const) {
        if (a < b) parts[part(a)].push({ ...run, text: run.text.slice(a - at, b - at) });
      }
    }
    at = end;
  }
  return parts;
}
