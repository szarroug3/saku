// What tonight's lesson teaches, from the app's tables. Server-side and
// dev-only, like the adapters beside it: the items come from the same
// build the Observatory uses (so a pick is the same thing here), and each
// star's card is filled from the app's own teaching data: a kana's
// mnemonic, a kanji's origin and readings, a word's example and pitch.
// Nothing is required; a sparse item stays short.

import { SETS } from "@/data/characters";
import { etymologyOf } from "@/data/kanji-etymology";
import { kanjiRow, READINGS } from "@/data/kanji";
import { getMnemonic, type SoundLine } from "@/data/mnemonics";
import { wordPitch } from "@/data/pitch";
import { vocabRow } from "@/data/vocab";
import { exampleFor } from "@/data/word-examples";
import { currentUserId } from "@/lib/auth";
import { emptyHistory } from "@/lib/history-ops";
import { loadHistory } from "@/lib/history";
import type { SkyLessonData } from "@/sky/components/sky-lesson";
import { buildGraph } from "@/sky/lib/graph";
import { lessonSteps, type LessonTeach } from "@/sky/lib/lesson";
import type { SkyItem } from "@/sky/lib/types";
import type { HistoryFile } from "@/types";

import { offerings } from "./observatory";

const text = (line: SoundLine) => line.map((s) => s.text).join("");

/** A kana's romaji, from the character sets. */
function romajiOf(glyph: string): string | undefined {
  for (const set of SETS) for (const s of set.sections) for (const ch of s.chars) if (ch.c === glyph) return ch.r[0];
  return undefined;
}

/** What the card says for one star, from whatever the app knows about it. */
function teachFor(item: SkyItem): LessonTeach {
  const t: LessonTeach = {};
  const glyph = item.glyph;
  if (item.kind === "kana") {
    t.reading = romajiOf(glyph);
    const m = getMnemonic(glyph);
    if (m) t.mnemonic = [text(m.analogy), text(m.mnemonic)].filter(Boolean);
    return t;
  }
  if (item.kind === "radical") {
    const m = getMnemonic(glyph);
    if (m) t.mnemonic = [text(m.mnemonic)].filter(Boolean);
    return t;
  }
  if (item.kind === "kanji") {
    const row = kanjiRow(glyph);
    if (row) { t.meanings = row.meanings; t.strokes = row.strokes; }
    const e = etymologyOf(glyph);
    if (e?.originText) t.etymology = e.originText;
    t.readings = READINGS.filter((r) => r.k === glyph).map((r) => ({ reading: r.base, inWord: r.anchor }));
    return t;
  }
  if (item.kind === "word" || item.kind === "counter") {
    const row = vocabRow(glyph);
    if (row) { t.reading = row.reb; t.meanings = row.glosses; }
    const ex = exampleFor(glyph);
    if (ex) t.example = { jp: ex.jp, en: ex.en };
    if (item.kind === "word") t.pitch = wordPitch(glyph);
    return t;
  }
  return t;
}

/** The signed-in learner's lesson for these picks, or a visitor's. */
export async function learnerLesson(picks: readonly string[], now = Date.now()): Promise<SkyLessonData> {
  const userId = await currentUserId();
  const history = userId ? await loadHistory(userId) : emptyHistory();
  return lessonFromPicks(history, picks, now);
}

export function lessonFromPicks(history: HistoryFile, picks: readonly string[], now = Date.now()): SkyLessonData {
  const offer = offerings(history, now);
  // every pick is built, whether or not its section had it on its first page
  const known = picks.filter((p) => !!offer.offerPick(p));
  const items = [...offer.items.values()];
  const byId = offer.items;
  const learned = [...offer.learned];
  const graph = buildGraph(items);
  const learnedSet = offer.learned;
  // the card for every star tonight: the steps, the picks, and the known stars under them
  const teach: Record<string, LessonTeach> = {};
  const ids = new Set<string>();
  for (const s of lessonSteps(graph, known, learnedSet)) ids.add(s.id);
  for (const p of known) for (const id of graph.orderOf(p)) ids.add(id);
  for (const id of ids) { const it = byId.get(id); if (it && !it.group) teach[id] = teachFor(it); }
  return { items, learned, picks: known, teach };
}
