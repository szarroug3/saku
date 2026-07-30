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
import { isKanaOnly, toHiragana, toKana } from "@/lib/romaji";
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

// ---------- romaji headwords ----------
//
// A deck typed without an IME writes "shito" and "anata", not 使徒 and あなた —
// romaji standing in for a pronunciation, exactly what the quiz grades a typed
// answer by and what the Library search resolves. So a row that misses the index
// directly gets one more try: read it as romaji, and if it converts CLEANLY to
// kana, look that sound up the way search does.
//
// This is a FALLBACK, never the primary path — a real kana/kanji headword still
// resolves through index() first and is neither slowed nor reinterpreted. Only a
// miss reaches here, and only a miss that is romaji-for-a-sound gets a match.

let KANA_INDEX: Map<string, EntryId> | null = null;

/**
 * Kana reading → entry, keyed by the hiragana a romaji headword converts to.
 * The relation search matches romaji on: a word by its READING (使徒 → しと), a
 * kana word or character by its glyph (あなた, し). Every key is folded to
 * hiragana so a katakana reading (コーヒー) is reachable from romaji all the same.
 *
 * First-wins, in the same source order index() uses — words before kana — so an
 * ambiguous sound lands on the everyday WORD and never a bare character, and two
 * words that share a reading (はし → 橋, 箸) resolve to the first in vocab order,
 * which is index()'s own tie-break for `reb`. Kanji are deliberately absent: a
 * single sound names dozens of them (せい is 生, 声, 星 …), and a romaji row is a
 * word the writer meant, not "the kanji as a unit of study" — the same call the
 * word-before-kanji ordering in index() already makes.
 */
function kanaIndex(): Map<string, EntryId> {
  if (KANA_INDEX) return KANA_INDEX;
  const map = new Map<string, EntryId>();
  for (const w of VOCAB) {
    const key = toHiragana(w.reb);
    if (!map.has(key)) map.set(key, wordEntry(w.keb));
  }
  for (const c of Object.keys(CHAR_INDEX)) {
    const key = toHiragana(c);
    if (!map.has(key)) map.set(key, kanaEntry(c));
  }
  KANA_INDEX = map;
  return map;
}

/**
 * A headword read as romaji, rendered as the kana it means — or null when it is
 * not romaji-for-a-sound. Mirrors search's `romajiReading`: lowercase, require a
 * latin letter, run the shared converter once, and accept ONLY when the result
 * is all kana. That last gate is what rejects real English — toKana leaves the
 * letters it cannot spell in place ("water" → わてr), so "water" fails isKanaOnly
 * and is still an English note, while "shito" (→ しと) passes. Folded to hiragana
 * so it compares against the folded keys above.
 */
function romajiReading(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (!/[a-z]/.test(lower)) return null;
  const kana = toKana(lower);
  return isKanaOnly(kana) ? toHiragana(kana) : null;
}

/** The entry a romaji headword resolves to, or null. The fallback readList runs
 * after the direct index misses. */
function romajiEntry(raw: string): EntryId | null {
  const reading = romajiReading(raw);
  return reading ? (kanaIndex().get(reading) ?? null) : null;
}

// ---------- English headwords ----------
//
// A file can also say what a word MEANS rather than how it is written or said:
// "person" for 人, the import twin of typing a meaning into the Library search.
// So a row that misses both the direct index and the romaji sound gets one last
// try: match it to the word whose gloss IS that meaning. Words only, and a whole
// SENSE must equal the query, not a loose substring, so "person" brings in the
// word for person and not "the person next to you".

let MEANING_INDEX: Map<string, EntryId> | null = null;

/**
 * English gloss → the word that means it. Each entry in `glosses` is already ONE
 * sense ("person", "you", "to shoot (a gun, person, etc.)"), so the WHOLE gloss
 * is the key, never a comma-split fragment of it. Splitting on commas was the bug
 * that made "person" resolve to 撃つ "to shoot (a gun, person, etc.)" instead of
 * 人: the comma there is inside a parenthetical, not a sense boundary. A gloss
 * DOES pack several senses comma-separated ("water, (cold) water"; "life, birth,
 * raw"), so we split on top-level commas and semicolons only, the ones NOT inside
 * parentheses, and key each whole sense. So "water" reaches 水 but "person" never
 * reaches 撃つ.
 *
 * When several words share a sense, the MOST EVERYDAY wins (lowest beginnerRank),
 * not the first in data order, so "person" is 人 and not 者. Words only, like
 * kanaIndex: a list names words, not kanji-as-units.
 */
function senses(gloss: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of gloss) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** A sense with its parenthetical qualifiers dropped: "water (esp. cold water)"
 * becomes "water", so a plain query reaches 水 and not just the compound 水分
 * whose sense happens to be the bare word. The paren CONTENT is discarded, never
 * indexed, which is also why "person" inside 撃つ's "to shoot (a gun, person...)"
 * can never key it. */
function bareSense(sense: string): string {
  return sense
    .replace(/[([][^)\]]*[)\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;]+$/, "")
    .trim();
}

function meaningIndex(): Map<string, EntryId> {
  if (MEANING_INDEX) return MEANING_INDEX;
  const best = new Map<string, { id: EntryId; rank: number }>();
  const keep = (key: string, id: EntryId, rank: number) => {
    if (!key) return;
    const cur = best.get(key);
    if (!cur || rank < cur.rank) best.set(key, { id, rank });
  };
  for (const w of VOCAB) {
    const id = wordEntry(w.keb);
    const rank = w.beginnerRank;
    for (const gloss of w.glosses) {
      for (const sense of senses(gloss)) {
        keep(sense, id, rank);
        keep(bareSense(sense), id, rank);
      }
    }
  }
  const map = new Map<string, EntryId>();
  for (const [k, v] of best) map.set(k, v.id);
  MEANING_INDEX = map;
  return map;
}

/** The word an English meaning resolves to, or null. The last fallback readList
 * runs, after the direct index and the romaji sound both miss. */
function englishEntry(raw: string): EntryId | null {
  const q = raw.trim().toLowerCase();
  if (!q || !/[a-z]/.test(q)) return null;
  return meaningIndex().get(q) ?? null;
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
 * The cells of a line — every comma/tab-separated value, each its own candidate.
 *
 * CSV and TSV both, and no dialect configuration: a line is split on the
 * delimiter and EACH value is a headword we look up independently. A "one word
 * per line" text file is the degenerate case — no delimiter, one cell. Quotes
 * are stripped because a CSV writer adds them; nothing else about RFC 4180
 * matters here. This means a "word,gloss" export treats the gloss as its own
 * cell too, which simply fails to match and lands in the "didn't match" table —
 * the same rule as "an import adds no content", shown honestly.
 */
function cells(line: string): string[] {
  return line
    .split(/[\t,]/)
    .map((field) => field.trim().replace(/^"(.*)"$/, "$1").trim())
    .filter((cell) => cell !== "");
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

    // Each comma/tab-separated cell is its own item, matched through the same
    // path. A line with no delimiter is a single cell, so one word per line is
    // unchanged. Blank cells are dropped, so a blank line yields nothing.
    for (const raw of cells(line)) {
      // Direct lookup first — a real kana/kanji headword is never slowed or
      // reinterpreted — then romaji-for-a-sound as a fallback for a deck typed
      // without an IME.
      const entry = index().get(raw) ?? romajiEntry(raw) ?? englishEntry(raw);
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
