// The component relation, read the other way round.
//
// `madeOf` in entries.ts answers "what is 明 built from" — 日 + 月. This file
// answers the INVERSE, "what is 日 a part of", and the inverse is the one that
// carries teaching weight: 日 turns up inside 210 of the 2,136 jōyō kanji, so
// learning the shape once pays 210 times, and a page that can say so is making
// the argument for learning it at all.
//
// ONE INDEX, TWO PAGES
// ====================
// The 237 components split 155 kanji / 82 primitives (see data/components.ts),
// and the two halves get their sections in different places — a kanji's on its
// existing entry page, a primitive's on /radical/[radical]. Both call the same
// three functions here, because "used as a part in" means exactly one thing and
// must not be computed twice with two different sorts.
//
// THE COUNTS ARE BIG AT THE TOP AND TINY IN THE TAIL: 一 is in 400 kanji, 口 in
// 381, ノ in 246; the median component is in 3. Anything painting a list from
// here must cap it — see COMPONENT_USE_CAP.
//
// A KANJI IS NEVER ITS OWN COMPONENT in this data (measured: 0 of 2,136), so no
// row here has to filter itself out. `how-its-written.tsx` filters `!== glyph`
// defensively and that stays; this index simply has nothing to drop.

import { KANJI, kanjiRow, orderRow } from "@/data/kanji";
import { VOCAB, vocabRow } from "@/data/vocab";
import { wordKnown } from "@/lib/word-unlock";
import type { HistoryFile } from "@/types";

/**
 * How many entries a "used as a part in" list may paint.
 *
 * The list is glyphs and nothing else, so it is far denser than the entry
 * page's eight-word "Appears in" row — 24 kanji is two or three wrapped lines,
 * where 24 words would be a screenful. What it may NOT be is uncapped: 口 would
 * put 381 links in a Links card and 一 would put 400, and past a couple of dozen
 * a reader is not reading the list, they are reading the number. So the list is
 * a sample and the COUNT is the finding, printed beside it.
 */
export const COMPONENT_USE_CAP = 24;

/** component → the kanji written with it, in teaching order. */
const USED_IN: ReadonlyMap<string, readonly string[]> = buildUsedIn();

function buildUsedIn(): ReadonlyMap<string, string[]> {
  const map = new Map<string, string[]>();
  for (const k of KANJI) {
    // Deduped per kanji: KRADFILE lists a repeated shape once per occurrence in
    // some rows, and 品 must count as ONE of 口's 381, not three.
    for (const c of new Set(k.comps)) {
      const list = map.get(c);
      if (list) list.push(k.c);
      else map.set(c, [k.c]);
    }
  }
  // TEACHING ORDER, NOT FREQUENCY — the same decision WordsWith argues for
  // words. `orderRow(c).i` is ramp B, "the order a beginner meets them"; a
  // newspaper-frequency sort would open 日's list on characters from years
  // ahead. Kanji outside the ramp sort last, by stroke count so the tail is at
  // least in a legible order rather than in JSON order.
  for (const list of map.values()) {
    list.sort((a, b) => {
      const ia = orderRow(a)?.i ?? Infinity;
      const ib = orderRow(b)?.i ?? Infinity;
      if (ia !== ib) return ia - ib;
      return (kanjiRow(a)?.strokes ?? 0) - (kanjiRow(b)?.strokes ?? 0);
    });
  }
  return map;
}

/** Every component KRADFILE attests, kanji and primitive alike — all 237. */
export function allComponents(): readonly string[] {
  return [...USED_IN.keys()];
}

/**
 * The kanji written with this component, in teaching order.
 *
 * Empty for anything that is not a component — a stranger, or one of the 74
 * kanji that KRADFILE never uses as a part of another. Empty is the honest
 * answer and the caller drops the section rather than printing a heading over
 * nothing.
 */
export function usedAsPartIn(c: string): readonly string[] {
  return USED_IN.get(c) ?? [];
}

/**
 * The words the user KNOWS that are written with a kanji containing this
 * component — the section the owner asked for by name.
 *
 * Two joins: component → kanji (this file) → words (the vocabulary's own kanji
 * spelling). "Known" is `wordKnown`, the app's single definition, so a word the
 * user CLAIMED ("I already know this") counts exactly as one they were taught —
 * see word-unlock.ts. There is deliberately no second notion of known here.
 *
 * Filtered before joined: the known set is at most a few hundred words while
 * 口's kanji reach several thousand, so this walks the vocabulary once and
 * tests membership rather than unioning 381 word lists and then filtering.
 *
 * Returned in teaching order (`beginnerRank`), matching WordsWith, which is the
 * component that paints it.
 */
export function knownWordsUsing(
  c: string,
  history: HistoryFile,
): readonly string[] {
  const kanji = new Set(usedAsPartIn(c));
  if (kanji.size === 0) return [];
  const out: string[] = [];
  for (const w of VOCAB) {
    let hit = false;
    for (const ch of w.keb) {
      if (kanji.has(ch)) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    if (!wordKnown(w.keb, history)) continue;
    out.push(w.keb);
  }
  out.sort(
    (a, b) =>
      (vocabRow(a)?.beginnerRank ?? Infinity) -
      (vocabRow(b)?.beginnerRank ?? Infinity),
  );
  return out;
}
