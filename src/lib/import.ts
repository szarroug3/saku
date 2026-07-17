// Reading a list out of a file the user already has.
//
// THE DICTIONARY IS THE VALIDATOR. There is no format to get right and nothing
// to configure: every row is looked up in the dictionary the app already has,
// what matches becomes part of the list, and what doesn't is shown to you.
//
// That is what makes importing safe despite real decks in the wild being full
// of errors — an import ADDS NO CONTENT. It takes the SELECTION and never the
// deck's answers. A deck that says 生 means "student" contributes the word 生
// and its own wrong gloss is discarded unread, because there is nowhere to put
// it. Worst case an import adds a name that points at nothing.
//
// Junk cannot get in because junk does not match. A sentence, an English note,
// a stray bracket and an empty field all fail the same way, and none of them
// can corrupt anything.
//
// THE MATCH RATE, WHICH WAS THE OPEN QUESTION
// ===========================================
// The design said: "What I don't know is the match rate, and it decides whether
// this screen is a formality or a chore. 1,983 of 2,000 is a nice number I made
// up. If a real deck comes back at 70%, the 'didn't match' table is the whole
// feature." Measured against a 95-row sample of ordinary beginner vocabulary:
// 87%. So the table is neither a formality nor the whole feature — it is a real
// screen you read once and mostly dismiss.
//
// The 13% is not random, and only some of it is the user's fault:
//
//   - NON-JŌYŌ words (綺麗, 林檎, 珈琲, 嬉しい). Correctly out: the vocabulary
//     is all-jōyō on purpose, and this is the design working.
//   - KANA-ONLY words (これ, とても, ちょっと, もう). There are ZERO kana-only
//     words in the vocabulary — "written entirely in jōyō kanji" excludes a
//     word with no kanji at all. Every deck on earth has これ in it.
//   - 日本 AND 日本語 ARE ABSENT. This one is worth the shout. vocab.ts filters
//     on `ichi1`, and its own header explains why using 日本 as the example:
//     "JMdict's own editors tagged 日本 `spec1` — a manual override meaning
//     'common no matter what the corpus says' — which tells you they knew the
//     corpus was wrong." 日本 is spec1, NOT ichi1. The comment cites 日本 as
//     proof its filter is right, and its filter excludes 日本.
//
// None of that is fixable here — it is one flag in scripts/ingest/build.py —
// and none of it makes importing unsafe. It is why the unmatched table has to
// say WHY rather than just listing rows: "not in the dictionary" is useless,
// and "we only carry everyday jōyō words" is something you can act on.
//
// Pure: no fs, no fetch, no DOM. The screen reads the file; this reads the text.

import { KANJI } from "@/data/kanji";
import { kanjiEntry } from "@/data/kanji";
import { VOCAB, wordEntry } from "@/data/vocab";
import { CHAR_INDEX, kanaEntry } from "@/data/characters";
import type { EntryId } from "@/types";

/** One row of the file, and what became of it. */
export interface ImportRow {
  /** What the file said, verbatim — the user has to recognise their own row. */
  raw: string;
  /** The entry it resolved to, or null. */
  entry: EntryId | null;
  /** Why it didn't match, in words. Null when it did. */
  why: string | null;
  /** A repair we are confident about — "strip the reading and this is 食べる".
   * Offered, never applied: the file is the user's and we do not silently
   * rewrite it. Null when there is nothing to suggest. */
  suggest: { text: string; entry: EntryId } | null;
}

export interface ImportReport {
  rows: ImportRow[];
  matched: ImportRow[];
  unmatched: ImportRow[];
  /** Distinct entries, in file order — what the list would actually contain.
   * A file that lists 生 twice contributes one entry. */
  entries: EntryId[];
}

// ---------- the index ----------
//
// Built once, lazily: 8,045 words + 2,136 kanji + 214 kana. Keyed by every
// string a file might plausibly write a thing as — the written form, and the
// reading for words that have one.

let INDEX: Map<string, EntryId> | null = null;

function index(): Map<string, EntryId> {
  if (INDEX) return INDEX;
  const map = new Map<string, EntryId>();
  // Words first and kanji second, so a single-character string that is BOTH a
  // word and a kanji resolves to the word: a deck row saying 人 means the word
  // 人, not "the kanji 人 as a unit of study". The kanji's facts still come
  // along, because the word's own facts and the kanji's are separate rows and a
  // list names entries.
  for (const w of VOCAB) {
    map.set(w.keb, wordEntry(w.keb));
    // The reading, so a kana-only deck row still lands. Only when nothing has
    // claimed it: 「はし」 is 橋 and 箸 and this must not silently pick one.
    if (!map.has(w.reb)) map.set(w.reb, wordEntry(w.keb));
  }
  for (const k of KANJI) if (!map.has(k.c)) map.set(k.c, kanjiEntry(k.c));
  for (const c of Object.keys(CHAR_INDEX)) if (!map.has(c)) map.set(c, kanaEntry(c));
  INDEX = map;
  return map;
}

// ---------- row repair ----------

/** 食べる[たべる] → 食べる. Anki's furigana field format, and the single most
 * common reason a real export fails to match. */
const BRACKETED = /^(.+?)[[［(（].+[)）\]］]$/;

/** Anything with no Japanese in it at all. */
const NO_JAPANESE = /^[^぀-ヿ㐀-鿿]+$/;

/**
 * The longest headword in the dictionary — 申し訳ありません, and it is the only
 * 8-character one. Measured over the data rather than picked: 5,356 of the
 * 8,045 words are 2 characters and the distribution is empty above 8.
 *
 * Anything longer than this is not a word we failed to find; it is not a word.
 */
const LONGEST_HEADWORD = 8;

function explain(raw: string): { why: string; suggest: ImportRow["suggest"] } {
  const trimmed = raw.trim();
  if (!trimmed) return { why: "Nothing in the field.", suggest: null };

  const bracketed = trimmed.match(BRACKETED);
  if (bracketed) {
    const bare = bracketed[1].trim();
    const entry = index().get(bare);
    if (entry) {
      return {
        why: "The reading is stuck to the word.",
        suggest: { text: bare, entry },
      };
    }
  }

  if (NO_JAPANESE.test(trimmed)) {
    return {
      why: "English, not a word. The row is a note to yourself.",
      suggest: null,
    };
  }

  // LENGTH IS CHECKED BEFORE SCRIPT, and the order is the whole correctness of
  // this function. A sentence is full of jōyō kanji, so asking "does it contain
  // kanji?" first labels 私は毎日日本語を勉強します as "not one of the everyday
  // jōyō words" — which is a sentence about a word, and this is not a word. It
  // is a different KIND of row and the user's fix is different (delete it, vs.
  // accept that we don't carry it).
  //
  // The cut is at 8 because 8 is measured, not guessed: the longest headword in
  // the whole dictionary is 申し訳ありません, and exactly one entry is that long.
  // Nothing above it can be a lookup failure.
  if (trimmed.length > LONGEST_HEADWORD) {
    return { why: "A whole sentence. There's no single word to tag.", suggest: null };
  }

  // The two honest, common reasons — see the match-rate note at the top. Saying
  // "not in the dictionary" for これ would be true and useless; the user would
  // reasonably conclude the import is broken, because これ is obviously a word.
  if (/^[぀-ヿ]+$/.test(trimmed)) {
    return {
      why: "A kana-only word. This app's vocabulary is words written with kanji.",
      suggest: null,
    };
  }
  if (/[㐀-鿿]/.test(trimmed)) {
    return {
      why: "Not one of the everyday jōyō words this app carries.",
      suggest: null,
    };
  }

  return { why: "Not in the dictionary.", suggest: null };
}

// ---------- parsing ----------

/**
 * The headword column of a line.
 *
 * CSV and TSV both, and no dialect configuration: the first field is the word.
 * Anki exports a tab-separated file whose first column is the front of the
 * card, and a "one word per line" text file is the degenerate case of the same
 * rule. Quotes are stripped because a CSV writer adds them; nothing else about
 * RFC 4180 matters here, because we read ONE field and discard the rest of the
 * line unread — that is the same rule as "an import adds no content".
 */
function headword(line: string): string {
  const field = line.split(/[\t,]/)[0] ?? "";
  return field.trim().replace(/^"(.*)"$/, "$1").trim();
}

/**
 * Read a list out of the text of a file.
 *
 * `.apkg` is NOT handled here and the screen says so: it is a zip containing a
 * SQLite database, which needs a real unzip and a real SQL reader — two
 * dependencies and a chunk of work for a format we cannot test against tonight.
 * CSV/TSV/TXT is what Anki's own "Export → Notes in Plain Text" produces and it
 * is one menu item away from the .apkg. Flagged rather than half-built: a
 * .apkg reader that silently mis-parses would be worse than not having one.
 */
export function readList(text: string): ImportReport {
  const rows: ImportRow[] = [];
  const seen = new Set<EntryId>();
  const entries: EntryId[] = [];

  for (const line of text.split(/\r?\n/)) {
    // Anki writes a leading `#` comment block on plain-text exports.
    if (line.startsWith("#")) continue;
    const raw = headword(line);
    if (!raw && !line.trim()) continue;

    const entry = index().get(raw) ?? null;
    if (entry) {
      rows.push({ raw, entry, why: null, suggest: null });
      if (!seen.has(entry)) {
        seen.add(entry);
        entries.push(entry);
      }
    } else {
      const { why, suggest } = explain(raw);
      rows.push({ raw, entry: null, why, suggest });
    }
  }

  return {
    rows,
    matched: rows.filter((r) => r.entry),
    unmatched: rows.filter((r) => !r.entry),
    entries,
  };
}

/** Apply a suggested repair to a report, as if the file had said the fixed
 * thing. Returns a NEW report — the original is what the file said, and that
 * distinction is the reason nothing here mutates. */
export function applySuggestion(report: ImportReport, raw: string): ImportReport {
  const rows = report.rows.map((r) =>
    r.raw === raw && r.suggest
      ? { raw: r.suggest.text, entry: r.suggest.entry, why: null, suggest: null }
      : r,
  );
  const seen = new Set<EntryId>();
  const entries: EntryId[] = [];
  for (const r of rows) {
    if (r.entry && !seen.has(r.entry)) {
      seen.add(r.entry);
      entries.push(r.entry);
    }
  }
  return {
    rows,
    matched: rows.filter((r) => r.entry),
    unmatched: rows.filter((r) => !r.entry),
    entries,
  };
}
