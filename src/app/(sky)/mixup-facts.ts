// What the mix-up coach is told about two entries (#BuildHybridAI): Saku's
// own facts about each, one plain line apiece, and the pair's hand-written
// tip when Saku has one (radical-tips.ts, shape-tips.ts). For a kanji that
// includes where its shape comes from and which of its pieces gives the
// sound and which the meaning (kanji-etymology.ts), since those are often
// the whole difference: 本 is a tree with its roots marked, and 持 and 待
// share 寺 for the sound. Nothing about the learner goes in: not their
// misses, not their history. The coach (src/sky/lib/mixup-coach.ts) checks its answer
// against exactly these lines, so whatever is not here, it may not say.
//
// Server only: the dictionaries are far too big to ship to the browser.

import { getMnemonic, type SoundLine } from "@/data/mnemonics";
import { kanjiRow, variantOriginal } from "@/data/kanji";
import { builtPieces, etymologyOf } from "@/data/kanji-etymology";
import { shapeTip } from "@/data/shape-tips";
import { radicalConfusableTip } from "@/data/radical-tips";
import { libEntry, type LibEntry } from "@/lib/library/entries";
import type { CoachRequest, CoachSide } from "@/sky/lib/mixup-coach";
import type { EntryId } from "@/types/facts";

const plain = (line: SoundLine) => line.map((s) => s.text).join("").trim();

/** What a learner would call the kind of thing it is. */
function kindName(e: LibEntry): string {
  if (e.kind === "kana") return e.sub.startsWith("Katakana") ? "katakana" : "hiragana";
  if (e.kind === "word") return "word";
  if (e.kind === "kanji") return "kanji";
  if (e.kind === "radical") return "kanji component";
  if (e.kind === "grammar") return "grammar pattern";
  return "mark";
}

/** A component with its meaning when Saku knows one: 寺 (Buddhist temple).
 * A variant form takes its original's meaning, and says so, because the
 * variant is what's drawn: 扌 (a form of 手, hand). */
function component(c: string): string {
  const own = kanjiRow(c)?.meanings[0] ?? libEntry(`radical:${c}` as EntryId)?.meanings[0];
  if (own) return `${c} (${own})`;
  const original = variantOriginal(c);
  const meaning = original && kanjiRow(original)?.meanings[0];
  return meaning ? `${c} (a form of ${original}, ${meaning})` : c;
}

/** What each piece of a kanji does in it, as the "Built from" labels say:
 * 扌 (a form of 手, hand) gives the meaning, 寺 gives the sound じ. Empty
 * when Saku doesn't know the pieces' jobs. */
function pieceJobs(kanji: string): string[] {
  return builtPieces(kanji).map((p) => p.role === "phonetic"
    ? `${p.glyph} gives the sound${p.label ? ` ${p.label}` : ""}`
    : `${p.label ? `${p.glyph} (${p.label})` : component(p.glyph)} gives the meaning`);
}

const ASIDE = /[;,]?\s*\b(contrast|compare|cf\.|see also)\b.*$/i;
const NOT_PLAIN = /[^\x20-\x7E\u2018\u2019\u201C\u201D]/gu;

/** The first sentence of where a kanji's shape comes from, for a kanji
 * whose origin is a picture or a combined idea: 本 is "a tree (木) with its
 * bottom highlighted with an extra stroke, accentuating the roots". A
 * sound-and-meaning kanji has its pieces' jobs instead. Null when the
 * sentence names a character other than the kanji and its own pieces,
 * since the coach may repeat anything it is given. */
export function shapeOrigin(kanji: string): string | null {
  const e = etymologyOf(kanji);
  if (!e?.originText || e.type === "phono-semantic") return null;
  const first = e.originText.split(/(?<=\.)\s/)[0]!
    .replace(/^(pictogram|ideogrammic compound)[^:]*:\s*/i, "")
    .replace(ASIDE, "")
    .replace(/[.;,\s]+$/, "");
  const pieces = [...(kanjiRow(kanji)?.comps ?? []), ...builtPieces(kanji).map((p) => p.glyph)];
  // 亻 is drawn, and the origin may name it as 人
  const own = new Set([kanji, ...pieces, ...pieces.map(variantOriginal).filter((c): c is string => !!c)]);
  const others = (first.match(NOT_PLAIN) ?? []).filter((c) => !own.has(c));
  return first && !others.length ? first : null;
}

/** One entry, as the coach is told about it. Null for an id this build has
 * no data for. */
function coachSide(id: EntryId): CoachSide | null {
  const e = libEntry(id);
  if (!e || !e.glyph) return null;
  const facts: string[] = [];
  if (e.kind === "kana") {
    facts.push(`sounds like: ${e.readings[0] ?? ""}`);
    const m = getMnemonic(e.glyph);
    if (m) {
      if (m.object) facts.push(`its shape is drawn as: ${m.object}`);
      facts.push(`the story for its shape and sound: ${plain(m.mnemonic)}`);
    }
  } else {
    if (e.meanings.length) facts.push(`means: ${e.meanings.slice(0, 3).join(", ")}`);
    if (e.readings.length) facts.push(`read: ${e.readings.slice(0, 3).join(", ")}`);
    const row = e.kind === "kanji" ? kanjiRow(e.glyph) : undefined;
    if (row?.comps?.length) facts.push(`made of: ${row.comps.map(component).join(" and ")}`);
    if (e.kind === "kanji") {
      const origin = shapeOrigin(e.glyph);
      if (origin) facts.push(`where its shape comes from: ${origin}`);
      const jobs = pieceJobs(e.glyph);
      if (jobs.length) facts.push(`what its pieces do: ${jobs.join("; ")}`);
    }
    if (row) facts.push(`strokes: ${row.strokes}`);
  }
  return { glyph: e.glyph, kind: kindName(e), facts };
}

/** The coach's request for a pair, `asked` first. Null when either side
 * has no data. */
export function coachRequest(asked: EntryId, other: EntryId): CoachRequest | null {
  const a = coachSide(asked);
  const b = coachSide(other);
  if (!a || !b) return null;
  const tip = radicalConfusableTip(a.glyph, b.glyph) ?? shapeTip(a.glyph, b.glyph);
  return { asked: a, other: b, ...(tip ? { tip } : {}) };
}
