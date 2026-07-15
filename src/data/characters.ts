// Character data — port of legacy/characters.py.
//
// HOW TO EXTEND
// =============
// - Add a section to an existing script: append to its `sections`.
// - Add a whole new set (kanji, vocab words, …): append a CharSet to SETS.
//   Every entry needs `c` (the Japanese) and `r` (accepted answers). Optional:
//   `m` (mnemonic, shown in the Kana chart), `meaning`, and the reserved
//   `strokes` / `audio` fields for the stroke-order, draw, and listen modes.

import type { CharInfo, CharSet, KanaChar } from "@/types";

// TODO(agent:data): full port of legacy/characters.py — SETS with every
// hiragana/katakana section, romaji variant arrays, and mnemonics.
export const SETS: CharSet[] = [];

/** Commonly-confused characters — MC distractors + results grouping. */
// TODO(agent:data): port LOOKALIKES from legacy/characters.py.
export const LOOKALIKES: string[][] = [];

/** char → flattened info (set/section labels, romaji). */
export const CHAR_INDEX: Record<string, CharInfo> = buildCharIndex();

/** char → its lookalikes (all other members of its LOOKALIKES groups). */
export const LOOK_GROUP: Record<string, string[]> = buildLookGroup();

/** romaji → kana (hiragana wins collisions), for the live typing preview. */
export const ROMAJI_TO_KANA: Record<string, string> = buildRomajiMap();

function buildCharIndex(): Record<string, CharInfo> {
  const index: Record<string, CharInfo> = {};
  for (const set of SETS) {
    for (const sec of set.sections) {
      for (const ch of sec.chars) {
        index[ch.c] = {
          c: ch.c,
          r: ch.r,
          set: set.id,
          setLabel: set.label,
          sec: sec.id,
          secLabel: sec.label,
          meaning: ch.meaning ?? null,
        };
      }
    }
  }
  return index;
}

function buildLookGroup(): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const group of LOOKALIKES) {
    for (const c of group) {
      (groups[c] ??= []).push(...group.filter((x) => x !== c));
    }
  }
  return groups;
}

function buildRomajiMap(): Record<string, string> {
  const map: Record<string, string> = {};
  // Reverse order so earlier sets (hiragana) win collisions.
  for (const set of [...SETS].reverse()) {
    for (const sec of set.sections) {
      for (const ch of sec.chars) {
        for (const r of ch.r) map[r] = ch.c;
      }
    }
  }
  return map;
}

/** Mnemonic for the Kana chart: explicit, combo-derived, or mark-derived. */
export function mnemonicFor(ch: KanaChar, secLabel: string): string {
  if (ch.m) return ch.m;
  if (ch.c.length > 1) return `${ch.c[0]} + small ${ch.c[1]}`;
  if (/^Dakuten/.test(secLabel)) return "base kana + ゛ voicing mark";
  if (/^Handakuten/.test(secLabel)) return "base kana + ゜ p-mark";
  return "";
}

/** Basic vs Extended grouping used by the character picker. */
export function isExtendedSection(label: string): boolean {
  return /^(Dakuten|Handakuten|Combo)/.test(label);
}
