// The reader's words against the learner's sky (#BuildHybridAI): each word
// kuromoji finds is matched to a Saku word by its dictionary form, so 見 in
// 見に行きました opens 見る, and carries the learner's standing with it. A word
// Saku doesn't teach carries the kanji in it that Saku does.
//
// Server only, like the splitter and the library it reads.

import { KANJI_SUBJECT } from "@/data/kanji";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { entryForGlyph, libEntry } from "@/lib/library/entries";
import { splitLine, type SplitWord } from "@/lib/reader-split";
import { READ_MAX, type ReadKanji, type ReadText, type ReadWord } from "@/sky/lib/reader";
import type { Standing } from "@/sky/lib/standing";
import type { EntryId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

import { standingFor } from "./learner";

const HAS_KANJI = /[\p{Script=Han}々]/u;

function standingOf(id: EntryId, history: HistoryFile, now: number): Standing {
  const e = libEntry(id);
  return e ? standingFor(e, history, now).standing : "not-seen";
}

function matchWord(w: SplitWord, history: HistoryFile, now: number): ReadWord {
  if (w.mark || !w.text.trim()) return { text: w.text, mark: true };
  const kanji = HAS_KANJI.test(w.text);
  const out: ReadWord = {
    text: w.text,
    ...(kanji && w.reading ? { reading: w.reading } : {}),
    ...(w.base && w.base !== w.text ? { base: w.base } : {}),
  };
  // the dictionary form first: し is する, and まし on its own would be a
  // word Saku has that this isn't. The text as written only when kuromoji
  // didn't know the word.
  const entry = entryForGlyph(VOCAB_SUBJECT, w.base ?? w.text);
  if (entry) return { ...out, entry, standing: standingOf(entry, history, now) };
  if (!kanji) return out;
  const found: ReadKanji[] = [];
  for (const c of new Set(w.text)) {
    const id = entryForGlyph(KANJI_SUBJECT, c);
    if (id) found.push({ id, glyph: c, standing: standingOf(id, history, now) });
  }
  return found.length ? { ...out, kanji: found } : out;
}

/** The text as the reader shows it: paragraphs of words, each matched to the
 * learner's sky. A text longer than READ_MAX is cut at the last line that
 * fits. */
export async function readFor(history: HistoryFile, text: string, now = Date.now()): Promise<ReadText> {
  const cut = text.length > READ_MAX;
  const kept = cut ? text.slice(0, Math.max(text.lastIndexOf("\n", READ_MAX), 0) || READ_MAX) : text;
  const lines = kept.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const paragraphs = await Promise.all(lines.map(async (line) => (await splitLine(line)).map((w) => matchWord(w, history, now))));
  return { paragraphs, ...(cut ? { cut: true as const } : {}) };
}
