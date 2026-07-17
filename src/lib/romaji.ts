// Romaji → kana, so English → Japanese answers can be TYPED without an IME.
//
// WHY THIS EXISTS
// ===============
// The en2jp typed style used to require the kana itself in the box, which on a
// laptop means an IME — the "needs IME" label said so out loud. Romaji input
// removes that: you type "kore" and これ forms in the field, WaniKani-style.
//
// THE HARD BOUNDARY: romaji only ever produces KANA. "sensei" is せんせい and
// "ka" is か, but there is no romaji for 生 — a kanji is not spellable. So this
// converter is only a grading path where the ANSWER is kana (a kana word like
// これ, a kana glyph); a kanji answer cannot be reached this way and must be
// asked some other way (multiple choice). Callers decide that; this file only
// does the conversion and says whether a string is all-kana.
//
// THE TABLE IS NOT RETYPED
// ========================
// Every base kana, dakuten, combo and romanization variant (shi AND si, tsu AND
// tu, ja/jya/zya …) already lives in src/data/characters.ts as the per-kana
// romaji lists the quiz grades jp2en against. This builds the REVERSE index
// from exactly that data, per script, so the two directions cannot drift and a
// new row added there is typable here for free. Only the things the table does
// NOT carry are added by hand: っ gemination, ん, the small-kana x/l escapes,
// and the ー long mark.

import { SETS } from "@/data/characters";

// ---------- the reverse index, built from the kana table ----------

/** romaji → kana, one map per script. First-wins on collision: ず/づ both
 * romanize "zu" and じ/ぢ both "ji", and the plain z-row (ず, じ) is the one you
 * mean — it appears before the d-row in the table, so first-wins picks it, and
 * du/di stay the only way to reach づ/ぢ. */
const HIRAGANA_MAP: Record<string, string> = buildMap("hiragana");
const KATAKANA_MAP: Record<string, string> = buildMap("katakana");

function buildMap(setId: string): Record<string, string> {
  const map: Record<string, string> = {};
  const set = SETS.find((s) => s.id === setId);
  if (!set) return map;
  for (const section of set.sections) {
    for (const ch of section.chars) {
      for (const r of ch.r) {
        // First-wins: don't let づ overwrite ず at "zu".
        if (!(r in map)) map[r] = ch.c;
      }
    }
  }
  return map;
}

/** Longest romaji key we may need to look ahead for (e.g. "xtsu"). */
const MAX_KEY = 4;

// ---------- small kana and marks the table doesn't carry ----------

const SMALL_TSU = { hira: "っ", kata: "ッ" } as const;
const N = { hira: "ん", kata: "ン" } as const;
const LONG_MARK = "ー";

/** x-/l-prefixed escapes for standalone small kana, the usual IME convention. */
const SMALL: Record<string, { hira: string; kata: string }> = {
  a: { hira: "ぁ", kata: "ァ" },
  i: { hira: "ぃ", kata: "ィ" },
  u: { hira: "ぅ", kata: "ゥ" },
  e: { hira: "ぇ", kata: "ェ" },
  o: { hira: "ぉ", kata: "ォ" },
  ya: { hira: "ゃ", kata: "ャ" },
  yu: { hira: "ゅ", kata: "ュ" },
  yo: { hira: "ょ", kata: "ョ" },
  tsu: { hira: "っ", kata: "ッ" },
  tu: { hira: "っ", kata: "ッ" },
};

function isVowel(c: string): boolean {
  return c === "a" || c === "i" || c === "u" || c === "e" || c === "o";
}

function isRomajiLetter(c: string): boolean {
  return c >= "a" && c <= "z";
}

export interface ToKanaOptions {
  /** Emit katakana instead of hiragana. */
  katakana?: boolean;
  /**
   * Live (as-you-type) mode: leave a trailing INCOMPLETE romaji run as latin
   * so the user still sees what they're mid-typing ("sens" → せんs, "ky" → ky).
   * A lone trailing "n" also stays "n" so "na" can still become な. Off (the
   * default) is final mode, where a trailing "n" resolves to ん and any
   * unresolved letter is passed through.
   */
  live?: boolean;
}

/**
 * Convert a romaji string to kana. Any character that is not romaji — kana,
 * kanji, punctuation, spaces — passes through untouched, which is what makes
 * the function idempotent on kana and safe to re-run on its own output (the
 * live input relies on this: its value is already-converted kana plus a latin
 * tail, and feeding that back in reconverts only the tail).
 */
export function toKana(input: string, opts: ToKanaOptions = {}): string {
  const kata = !!opts.katakana;
  const live = !!opts.live;
  const map = kata ? KATAKANA_MAP : HIRAGANA_MAP;
  const smallTsu = kata ? SMALL_TSU.kata : SMALL_TSU.hira;
  const nKana = kata ? N.kata : N.hira;

  const s = input.toLowerCase();
  let out = "";
  let i = 0;

  while (i < s.length) {
    const c = s[i];

    // Not romaji (kana, kanji, space, punctuation): copy and move on.
    if (!isRomajiLetter(c)) {
      // A hyphen is the katakana long-vowel mark; keep it as ー.
      out += c === "-" ? LONG_MARK : c;
      i++;
      continue;
    }

    // ---- ん, in all the ways it is written ----
    if (c === "n") {
      const nx = s[i + 1];
      if (nx === "'") {
        out += nKana;
        i += 2;
        continue;
      }
      if (nx === "n") {
        // "nn" → ん, but "nna"/"nny" is ん + the next syllable, so only eat the
        // second n when a vowel/y does NOT follow it.
        const nx2 = s[i + 2];
        if (isVowel(nx2) || nx2 === "y") {
          out += nKana;
          i += 1;
        } else {
          out += nKana;
          i += 2;
        }
        continue;
      }
      if (nx === undefined) {
        // End of input: ん when finalizing, pending when typing.
        if (live) {
          out += "n";
          i++;
        } else {
          out += nKana;
          i++;
        }
        continue;
      }
      // n before a consonant that isn't y → ん (sensei, kanji). n + vowel or
      // n + y falls through to the table (na, ni, nya).
      if (isRomajiLetter(nx) && !isVowel(nx) && nx !== "y") {
        out += nKana;
        i++;
        continue;
      }
    }

    // ---- っ from a doubled consonant (kitto → きっと), and the tch case ----
    if (c === "t" && s[i + 1] === "c" && s[i + 2] === "h") {
      out += smallTsu; // matcha → まっちゃ
      i++;
      continue;
    }
    if (
      !isVowel(c) &&
      c !== "n" &&
      c !== "x" &&
      c !== "l" &&
      s[i + 1] === c
    ) {
      out += smallTsu;
      i++;
      continue;
    }

    // ---- x-/l-escaped small kana (xtsu → っ, xya → ゃ) ----
    if (c === "x" || c === "l") {
      let hit = false;
      for (let len = 3; len >= 1; len--) {
        const key = s.slice(i + 1, i + 1 + len);
        const small = SMALL[key];
        if (small) {
          out += kata ? small.kata : small.hira;
          i += 1 + len;
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    // ---- longest-match against the table (kya beats ki, tsu beats t) ----
    let matched = false;
    for (let len = Math.min(MAX_KEY, s.length - i); len >= 1; len--) {
      const chunk = s.slice(i, i + len);
      const kana = map[chunk];
      if (kana) {
        out += kana;
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // ---- unresolved letter ----
    if (live) {
      // Whatever is left is an incomplete syllable the user is still typing —
      // show it verbatim and stop, rather than mangling it character by char.
      out += s.slice(i);
      break;
    }
    // Final mode: pass the stray letter through so a typo stays visible rather
    // than vanishing.
    out += c;
    i++;
  }

  return out;
}

// ---------- script helpers used by the grader ----------

/** Fold katakana to hiragana so a comparison ignores which script the answer
 * happens to be written in. Non-katakana characters are left as-is. */
export function toHiragana(str: string): string {
  let out = "";
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    // Katakana block, excluding the long mark ー (U+30FC) and the middle dot,
    // which have no hiragana equivalent and must stay put.
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

/** True when every character is kana (either script), the small kana, or the
 * long mark — i.e. a string romaji could actually have produced. Empty is
 * false: nothing is not an answer. A kanji anywhere makes it false, which is
 * the whole point — that answer is not reachable by typing romaji. */
export function isKanaOnly(str: string): boolean {
  const s = str.trim();
  if (!s) return false;
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    const hira = code >= 0x3041 && code <= 0x3096;
    const kata = code >= 0x30a1 && code <= 0x30fa;
    const mark = code === 0x30fc || code === 0x30a0; // ー, ゠
    if (!hira && !kata && !mark) return false;
  }
  return true;
}

/**
 * Does a typed answer match a kana target, allowing romaji, raw kana, or a
 * mix, and ignoring script? This is the one function the en2jp grader needs.
 *
 * `given` is finalized as romaji (a trailing "n" becomes ん) and folded to
 * hiragana; the target is folded the same way. Because toKana passes kana
 * through untouched, someone who typed the kana directly (an IME user) is
 * graded by the same path — their input finalizes to itself.
 */
export function romajiMatches(given: string, targetKana: string): boolean {
  const g = toHiragana(toKana(given.trim())).trim();
  const t = toHiragana(targetKana).trim();
  return g === t && t.length > 0;
}
