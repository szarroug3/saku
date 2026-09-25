// A line of runs cut at a span, so one stretch of it can be drawn apart from
// the rest (SAK-481): the word a word card's sentence underlines, the particle
// the Particle table picks out. Once a sentence carries furigana it is runs,
// not a string, and the span still counts in characters of the sentence.
//
// And prose (SAK-484): English with Japanese in it, split into the runs of
// Japanese that need readings, each run given its readings by whoever knows
// them, and a run's whole reading split over its kanji.

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

/** A stretch of Japanese inside prose: kana, kanji, the iteration mark, the
 * long-vowel bar and the wave dash, with nothing between them. 猫は好きです in
 * "猫は好きです is about cats" is one run; "好き, きらい" is two. */
const JAPANESE_RUN = /[぀-ゟ゠-ヿ㐀-䶿一-鿿々〜ー]+/g;
const KANJI = /[㐀-䶿一-鿿々]/;
/** A group of kanji with no kana between them: the stretch one reading covers. */
const KANJI_GROUP = /[㐀-䶿一-鿿々]+/g;

/** The runs of Japanese in a line of prose that have a kanji in them, left to
 * right: what a line needs readings for. The script that lists sentences for
 * the readings pass splits prose with this too, so a row is keyed by the run
 * exactly as the page looks it up. */
export function kanjiRunsIn(text: string): string[] {
  return (text.match(JAPANESE_RUN) ?? []).filter((run) => KANJI.test(run));
}

/** Prose with each run of Japanese given its readings (SAK-484).
 *
 * `read` answers for one run: the run as runs with kana over its kanji, or
 * nothing when it has no reading to give. A run it cannot answer for, or
 * answers with runs that do not spell it, stays plain, and so does
 * everything that is not Japanese. Plain stretches next to each other are
 * joined, so a line with no readings in it comes back as one run. */
export function rubyProse(text: string, read: (run: string) => SoundLine | undefined): Run[] {
  const out: Run[] = [];
  const plain = (s: string) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last && last.ruby === undefined) out[out.length - 1] = { text: last.text + s };
    else out.push({ text: s });
  };
  let at = 0;
  for (const m of text.matchAll(JAPANESE_RUN)) {
    plain(text.slice(at, m.index));
    at = m.index + m[0].length;
    const line = KANJI.test(m[0]) ? read(m[0]) : undefined;
    if (line && line.map((r) => r.text).join("") === m[0] && line.some((r) => r.ruby)) {
      for (const r of line) if (r.ruby) out.push({ text: r.text, ruby: r.ruby }); else plain(r.text);
    } else plain(m[0]);
  }
  plain(text.slice(at));
  return out;
}

/** Katakana folded to hiragana, so a reading matches the kana written in a run
 * whichever script the run uses. */
const hiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** A run of Japanese with its whole reading written out (みる for 見る), as runs
 * with each group of kanji carrying its share of the reading (み over 見).
 *
 * The kana in the run are matched against the reading and what is left is the
 * kanji's: 生まれる read うまれる puts う over 生, and 時々 read ときどき puts the
 * whole reading over 時々, which is one group. Undefined when the kana do not
 * line up with the reading, since that is a wrong reading and not one to
 * print. */
export function rubyFromReading(run: string, reading: string): SoundLine | undefined {
  const groups = run.match(KANJI_GROUP);
  if (!groups) return undefined;
  const kana = run.split(KANJI_GROUP);
  const escape = (s: string) => hiragana(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^${kana.map(escape).join("(.+?)")}$`).exec(hiragana(reading));
  if (!m) return undefined;
  const line: Run[] = [];
  kana.forEach((k, i) => {
    if (k) line.push({ text: k });
    if (i < groups.length) line.push({ text: groups[i], ruby: m[i + 1] });
  });
  return line;
}
