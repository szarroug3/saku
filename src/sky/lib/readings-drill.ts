// The readings drill, as a model (SAK-495). A kanji's readings are shown with
// no labels and the learner sorts each one as kun'yomi or on'yomi. This file
// is everything about it that is not drawing: which readings a kanji shows,
// which kanji come first, the shuffle, the grading and the score. The screen
// is sky-readings-drill.tsx, and the route hands it the pool.
//
// Nothing here is stored. A run lives in the screen's state and is gone when
// the page is left, the way the card asks ("session only for now").
//
// WHICH READINGS A KANJI SHOWS
// ============================
// The table's rows for the kanji (the same rows the kanji card's Readings
// fold lists), with two changes:
//
// 1. A voiced kun'yomi folds into its base. The table lists び beside ひ for
//    火 and ごころ beside こころ for 心. That is the same native word with its
//    first sound voiced by the word in front of it (rendaku), so sorting both
//    would be sorting one reading twice. Its words count toward the base.
//    An on'yomi never folds: だい and たい are two on'yomi of 大, borrowed
//    separately, and 大学 (university) is read だい. Only kun'yomi take
//    rendaku, so a voiced on'yomi is a reading of its own.
// 2. A reading heard in fewer than five everyday words is left out, unless it
//    is the most heard reading of its kind (on, kun, or filed under both). 日's か (only in words like 二日,
//    the second of the month) and 人's と are left out; 火's ひ stays because
//    it is 火's main kun'yomi.
//
// WHICH KANJI COME FIRST
// ======================
// By how many readings of one kind a kanji has, at most: one (one kun'yomi
// and one on'yomi, like 水 みず and すい), then two (人 has じん and にん, 日
// has にち and じつ), then three or more. Inside each group, the kanji come in
// the app's own teaching order, so the kanji a learner meets first come first.
// A kanji with no kun'yomi or no on'yomi has nothing to sort and is skipped.

import { shuffled } from "./random";

/** What the kanji table says a reading is. "both" is a reading the dictionary
 * files under both kinds, for different senses. */
type ReadingKind = "on" | "kun" | "both";

/** The two answers. */
export type ReadingLabel = "kun" | "on";

/** The labels as the buttons and the reveal write them. */
export const READING_LABEL: Record<ReadingLabel, string> = { kun: "kun'yomi", on: "on'yomi" };

/** One row of the kanji table: a reading, its kind, and how many everyday
 * words use it. */
interface TableReading {
  reading: string;
  kind: ReadingKind;
  words: number;
}

/** A kanji and its rows, in the table's order. */
export interface TableKanji {
  kanji: string;
  readings: readonly TableReading[];
}

/** A reading as the drill shows it. */
export interface DrillReading {
  reading: string;
  kind: ReadingKind;
}

/** How many readings of one kind the kanji has, at most: 1, 2, or 3 for
 * three or more. */
type DrillTier = 1 | 2 | 3;

export interface DrillKanji {
  kanji: string;
  readings: readonly DrillReading[];
  tier: DrillTier;
}

/** A reading heard in at least this many everyday words is always shown. */
const COMMON_WORDS = 5;

const VOICED: Readonly<Record<string, string>> = Object.fromEntries(
  ["がか", "ぎき", "ぐく", "げけ", "ごこ", "ざさ", "じし", "ずす", "ぜせ", "ぞそ", "だた", "ぢち", "づつ", "でて", "どと", "ばは", "びひ", "ぶふ", "べへ", "ぼほ", "ぱは", "ぴひ", "ぷふ", "ぺへ", "ぽほ"].map((pair) => [pair[0], pair[1]]),
);

/** The reading with its first sound unvoiced, or undefined when the first
 * sound is not voiced: ごころ is こころ, び is ひ. */
function unvoiced(reading: string): string | undefined {
  const base = VOICED[reading[0]];
  return base ? base + reading.slice(1) : undefined;
}

/** The rows with each voiced kun'yomi folded into its unvoiced kun'yomi. The
 * base keeps its place and takes the twin's words. A twin with no kun'yomi
 * base stays as it is, and an on'yomi is never folded (see the top of the
 * file). */
function foldVoiced(rows: readonly TableReading[]): TableReading[] {
  const twins = new Map<number, number>();
  rows.forEach((row, i) => {
    const base = row.kind === "kun" ? unvoiced(row.reading) : undefined;
    const at = base === undefined ? -1 : rows.findIndex((r) => r.reading === base && r.kind === "kun");
    if (at >= 0) twins.set(i, at);
  });
  const extra = new Map<number, number>();
  for (const [twin, base] of twins) extra.set(base, (extra.get(base) ?? 0) + rows[twin].words);
  const out: TableReading[] = [];
  rows.forEach((row, i) => {
    if (twins.has(i) || out.some((r) => r.reading === row.reading)) return;
    out.push({ ...row, words: row.words + (extra.get(i) ?? 0) });
  });
  return out;
}

const onSide = (kind: ReadingKind) => kind === "on" || kind === "both";
const kunSide = (kind: ReadingKind) => kind === "kun" || kind === "both";

/** The readings the drill shows for one kanji, in the table's order: voiced
 * twins folded, and a rare reading left out unless it is the most heard of
 * its kind. */
function drillReadings(rows: readonly TableReading[]): DrillReading[] {
  const folded = foldVoiced(rows);
  const top = (kind: ReadingKind) => {
    let best: TableReading | undefined;
    for (const r of folded) if (r.kind === kind && (!best || r.words > best.words)) best = r;
    return best;
  };
  const keep = new Set([top("on"), top("kun"), top("both")].filter((r): r is TableReading => !!r));
  return folded.filter((r) => r.words >= COMMON_WORDS || keep.has(r)).map(({ reading, kind }) => ({ reading, kind }));
}

/** Which group a kanji falls in, by the most readings it has of one kind. */
function tierOf(readings: readonly DrillReading[]): DrillTier {
  const most = Math.max(readings.filter((r) => onSide(r.kind)).length, readings.filter((r) => kunSide(r.kind)).length);
  return most <= 1 ? 1 : most === 2 ? 2 : 3;
}

/** The drill's kanji, in the order they are asked, and the kanji left out
 * because they have nothing to sort. `table` comes in the app's teaching
 * order, which is the order inside each group. */
export function drillPool(table: readonly TableKanji[]): { pool: DrillKanji[]; skipped: string[] } {
  const pool: DrillKanji[] = [];
  const skipped: string[] = [];
  for (const { kanji, readings: rows } of table) {
    const readings = drillReadings(rows);
    const sortable = readings.length >= 2 && readings.some((r) => onSide(r.kind)) && readings.some((r) => kunSide(r.kind));
    if (sortable) pool.push({ kanji, readings, tier: tierOf(readings) });
    else skipped.push(kanji);
  }
  // a stable sort, so the teaching order holds inside each group
  return { pool: pool.map((k, i) => ({ k, i })).sort((a, b) => a.k.tier - b.k.tier || a.i - b.i).map(({ k }) => k), skipped };
}

/** The readings in a random order, with nothing to say which is which. */
export function shuffleReadings(kanji: DrillKanji, random: () => number = Math.random): DrillReading[] {
  return shuffled(kanji.readings, random);
}

/** Whether a label is right for a reading. A reading filed under both kinds
 * takes either. */
export function isRight(reading: DrillReading, label: ReadingLabel): boolean {
  return reading.kind === "both" || reading.kind === label;
}

/** What the reveal says the reading is: "kun'yomi", "on'yomi", or both. */
export function rightLabel(reading: DrillReading): string {
  return reading.kind === "both" ? `${READING_LABEL.kun} and ${READING_LABEL.on}` : READING_LABEL[reading.kind];
}

export interface DrillScore {
  /** Readings labeled right. */
  right: number;
  /** Readings labeled at all. */
  labeled: number;
  /** Kanji with at least one reading labeled. */
  kanji: number;
}

/** A run of the drill: which kanji it is on, the labels given on that kanji
 * (by reading), the score so far, and whether it has ended. */
export interface DrillRun {
  at: number;
  labels: Readonly<Record<string, ReadingLabel>>;
  score: DrillScore;
  ended: boolean;
}

export function startRun(): DrillRun {
  return { at: 0, labels: {}, score: { right: 0, labeled: 0, kanji: 0 }, ended: false };
}

/** A reading labeled. The first label given is the one that counts: a
 * reading already labeled, a reading this kanji does not have, and a run
 * that has ended are all left as they are. */
export function labelReading(run: DrillRun, pool: readonly DrillKanji[], reading: string, label: ReadingLabel): DrillRun {
  const found = pool[run.at]?.readings.find((r) => r.reading === reading);
  if (run.ended || !found || run.labels[reading]) return run;
  const first = Object.keys(run.labels).length === 0;
  return {
    ...run,
    labels: { ...run.labels, [reading]: label },
    score: {
      right: run.score.right + (isRight(found, label) ? 1 : 0),
      labeled: run.score.labeled + 1,
      kanji: run.score.kanji + (first ? 1 : 0),
    },
  };
}

/** Whether every reading of the kanji showing has a label. */
export function kanjiDone(run: DrillRun, pool: readonly DrillKanji[]): boolean {
  const kanji = pool[run.at];
  return !!kanji && kanji.readings.every((r) => run.labels[r.reading]);
}

/** On to the next kanji. Past the last one, the run ends. */
export function nextKanji(run: DrillRun, pool: readonly DrillKanji[]): DrillRun {
  if (run.ended) return run;
  const at = run.at + 1;
  return at >= pool.length ? { ...run, labels: {}, ended: true } : { ...run, at, labels: {} };
}

/** The End quiz button: the run stops where it is, with its score. */
export function endRun(run: DrillRun): DrillRun {
  return { ...run, ended: true };
}
