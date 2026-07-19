// A word, taken apart into the pieces that each contribute a sound.
//
// 先生 is not "せんせい". It is 先 saying せん and 生 saying せい, and the whole
// point of the word page is that you can SEE that — because the moment you can,
// 先 and 生 stop being shapes you memorised and start being things you can read
// a new word with. This module is the split, and the one claim the app is
// willing to make about it.
//
// WHERE THE SPLIT COMES FROM
// ==========================
// `align` on the vocab row, which the ingest built and which stores, per kanji,
// [the character, what it says IN THIS WORD, its base reading]. 誕生日 is
// [誕 たん たん][生 じょう しょう][日 び び] — note the third column differing from
// the second, which is the sound shift 生 undergoes in that word and is exactly
// the kind of thing a hand-rolled split would get wrong.
//
// `align` is null for the 2.6% that CANNOT be split — the jukujikun, 大人/おとな,
// 為替/かわせ. There is no per-kanji reading in 大人 to show, so the section is
// absent rather than guessed. That is the same refusal the ingest makes when it
// declines to mint per-kanji facts for those words.

import { KANJI_SUBJECT } from "@/data/kanji";
import { READINGS } from "@/data/kanji";
import type { VocabRow } from "@/data/vocab";
import { entryForGlyph } from "@/lib/library/entries";
import type { EntryId } from "@/types";

/** The iteration mark. 人々 is written with one 人 and a 々 that repeats it, but
 * `align` expands both — so a walk over the written form has to know that 々
 * occupies a kanji slot whose CHARACTER comes from the position before it. 33
 * words in the vocabulary use it; without this they would fail to align at all. */
const ITERATION_MARK = "々";

function isKana(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && cp >= 0x3041 && cp <= 0x30ff;
}

/**
 * One piece of a written word.
 *
 * A kanji piece is a LINK — it is an entry with a page of its own, and following
 * it is the whole reason to break the word up. A kana piece is not, and the
 * distinction is load-bearing: see `okurigana` below.
 */
export type WordPiece =
  | {
      readonly kind: "kanji";
      /** The character as written — 々 for an iteration mark. */
      readonly written: string;
      /** The character it STANDS FOR, which differs only for 々. This is what
       * the link points at and what the reading belongs to. */
      readonly char: string;
      /** What it says in this word. 生 in 誕生日 is じょう. */
      readonly reading: string;
      /** Its reading out of context. しょう — the one the dictionary files it
       * under, and the one that makes the shift above visible. */
      readonly base: string;
      readonly entry: EntryId | null;
    }
  | {
      readonly kind: "kana";
      readonly text: string;
      /**
       * Whether this run is the okurigana — the kana AFTER the last kanji.
       *
       * ONLY THE TRAILING RUN. お in お客様 is a polite prefix and っ in 引っ越す
       * sits between two kanji; neither is okurigana, and labelling them so would
       * teach a false rule about a word the learner is looking at. Those render
       * as plain kana with no claim attached, which is honest and costs nothing.
       *
       * The trailing run is the one worth naming, because it is the part that
       * CHANGES — 生きる and 生まれる differ in nothing else — and a reader who
       * doesn't know that reads the tail as decoration.
       */
      readonly okurigana: boolean;
    };

/**
 * A word split into its pieces, or null when it cannot be split.
 *
 * Null for the jukujikun (`align === null`) and for an all-kana word, which has
 * no pieces to show — これ is not 這 + something, it is これ, and a "built from"
 * section over one kana run would be the word printed twice.
 */
export function piecesOf(w: VocabRow): readonly WordPiece[] | null {
  if (!w.align || w.align.length === 0) return null;

  const out: WordPiece[] = [];
  let ai = 0;
  let pending = "";
  let lastKanji = "";

  const flushKana = () => {
    if (!pending) return;
    out.push({ kind: "kana", text: pending, okurigana: false });
    pending = "";
  };

  for (const ch of w.keb) {
    if (isKana(ch)) {
      pending += ch;
      continue;
    }
    const slot = w.align[ai];
    // The written form and `align` disagree — a shape this function has no
    // reading for. Refuse the whole word rather than emit a piece with a sound
    // taken from the wrong slot; a mis-split is worse than no split, because it
    // reads as taught rather than as missing.
    const expected = ch === ITERATION_MARK ? lastKanji : ch;
    if (!slot || slot[0] !== expected) return null;
    flushKana();
    ai++;
    lastKanji = expected;
    out.push({
      kind: "kanji",
      written: ch,
      char: expected,
      reading: slot[1],
      base: slot[2],
      entry: entryForGlyph(KANJI_SUBJECT, expected),
    });
  }
  if (ai !== w.align.length) return null;

  // The trailing kana run, and only it, is the okurigana.
  if (pending) out.push({ kind: "kana", text: pending, okurigana: true });
  return out;
}

// ---------- what the pieces are DOING: the compound note ----------

/** kanji + base reading → whether that reading came in from Chinese or is the
 * native Japanese word, per KANJIDIC2. "both" is the dictionary declining to
 * choose, and this module declines with it. */
const READING_TYPE: ReadonlyMap<string, "on" | "kun" | "both"> = buildReadingTypes();

function buildReadingTypes(): Map<string, "on" | "kun" | "both"> {
  const map = new Map<string, "on" | "kun" | "both">();
  for (const r of READINGS) {
    if (!r.type) continue;
    const key = `${r.k}|${r.base}`;
    const prev = map.get(key);
    map.set(key, prev && prev !== r.type ? "both" : r.type);
  }
  return map;
}

/**
 * "Both kanji use their Chinese reading here" — the sentence that turns a split
 * into a rule.
 *
 * WHY IT IS WORTH GENERATING. The split alone says 先 is せん and 生 is せい. It
 * does not say WHY, and the why is a pattern that transfers: a two-kanji compound
 * is usually read with both characters' borrowed Chinese sounds, and a kanji
 * standing alone or with a kana tail is usually read with its native Japanese
 * one. Once you have seen that stated over 先生, you have a guess for the next
 * compound you meet — which is the difference between memorising words and
 * reading them.
 *
 * KEYED ON THE BASE READING, NOT THE SURFACE — and this is the correction to the
 * measurement the design was planned against. Crossing the SURFACE column
 * against readings.json resolves 96% of pieces, 92% of words and 90% of
 * multi-kanji compounds, because a sound-shifted surface (誕生日's じょう) is not
 * a reading the dictionary lists. But `align` already carries the base in its
 * third column — しょう, which IS listed — so keying on that resolves 100% of
 * pieces and 100% of words. The shift was never missing data; it was the wrong
 * column.
 *
 * SILENT RATHER THAN GUESSING, still, and for a smaller but real case: 208
 * multi-kanji words have at least one piece whose reading KANJIDIC2 files under
 * both types. The dictionary has declined to say which sense is in play, so
 * there is no sentence to write and this returns null.
 */
export function compoundNote(pieces: readonly WordPiece[]): string | null {
  const kanji = pieces.filter((p) => p.kind === "kanji");
  // A one-kanji word is not a compound, and the pattern the note teaches is a
  // pattern ABOUT compounds. 生きる gets no note; its story is the okurigana,
  // which the tail already tells.
  if (kanji.length < 2) return null;

  const types = kanji.map((p) => READING_TYPE.get(`${p.char}|${p.base}`));
  // Never guess the half we do not have. One unresolved or ambiguous piece and
  // the whole sentence goes, because "both kanji" is a claim about both.
  if (types.some((t) => t === undefined || t === "both")) return null;

  const all = (t: "on" | "kun") => types.every((x) => x === t);
  const many = kanji.length === 2 ? "Both kanji" : `All ${kanji.length} kanji`;

  if (all("on")) {
    return `${many} use their Chinese reading here — the usual pattern when kanji sit together in a compound.`;
  }
  if (all("kun")) {
    return `${many} use their native Japanese reading here.`;
  }
  // Mixed. Naming which is which is the useful part: it is the case the general
  // rule does not cover, so a reader who only had the rule would get it wrong.
  const named = kanji
    .map((p, i) => `${p.written} its ${types[i] === "on" ? "Chinese" : "native Japanese"}`)
    .join(", ");
  return `A mix here — ${named} reading.`;
}
