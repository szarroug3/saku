// The teachable pieces of a kanji — "built from parts you learn on their own".
//
// Lifted out of components/lesson/how-its-written.tsx so the drill's hint
// builder can ask the same question the lesson asks, with the same answer. Two
// copies of this test would be two chances for the lesson and the hint to
// disagree about what 明 is made of.
//
// NOW DRIVEN BY THE ETYMOLOGY LAYER, NOT THE RAW SHAPE DECOMPOSITION. It used to
// be an all-or-nothing pass over KanjiVG's `comps`: return every component only
// when all of them are themselves jōyō kanji, so a bound form (亻, 氵) killed the
// whole list. That is the SHAPE question. The question the app now teaches is the
// etymology one — which pieces carry the meaning or the sound — so this reads
// `builtPieces` (src/data/kanji-etymology.ts, the same lookup the Library's and
// the lesson's "Built from" render) and keeps the ones a learner can actually be
// taught: a piece with a kanji card, or a radical. A memorised whole (a
// pictograph, the number kanji, a kanji Wiktionary can't usefully split) has no
// pieces and yields null. This keeps the hint builder, the lesson and the Library
// in agreement about what a kanji is made of, because all three read the one join.

import { builtPieces } from "@/data/kanji-etymology";
import { kanjiRow, variantOriginal } from "@/data/kanji";
import { radicalByWrittenForm } from "@/data/radicals";

export interface KanjiPart {
  readonly c: string;
  readonly meaning: string;
}

/**
 * Collapse an enclosing radical that KanjiVG split into a leading + trailing
 * copy around the content it frames. 可 has ONE 丁-shaped frame around 口, but
 * KanjiVG's depth-1 decomposition renders the wrapper as its two halves and
 * records `["丁","口","丁"]`; likewise 哀 `["衣","口","衣"]`, 囚 `["囗","人","囗"]`,
 * 衰 `["衣","口","口","衣"]`, 図 `["囗","⺍","乂","囗"]`. Shown verbatim, the lesson
 * and drill hint say the frame twice.
 *
 * The signature of that split — and ONLY that split — is: the first and last
 * entries are the SAME element AND that element does not appear anywhere between
 * them. One wrapper, opened and closed around a different interior. We drop the
 * trailing copy, leaving a single frame.
 *
 * A genuine repetition never matches, so it is left intact:
 *   - a RUN of the same glyph (品 口口口, 器 口口大口口, 晶 日日日, 三 一一一) puts
 *     that glyph in the middle too, so the "not in the interior" test fails;
 *   - a side-by-side PAIR (林 木木, 双 又又, 炎 火火) has no interior at all — it is
 *     two components, not a frame around content — so we require length ≥ 3.
 */
export function deframe(comps: readonly string[]): readonly string[] {
  const x = comps[0];
  if (comps.length >= 3 && comps[comps.length - 1] === x && !comps.slice(1, -1).includes(x)) {
    return comps.slice(0, -1);
  }
  return comps;
}

/**
 * The display meaning of one piece a learner can be taught to name: a kanji's own
 * gloss, a radical's meaning, or — for a variant form with no card of its own (亻,
 * 氵) — the meaning of the character it stands for (人, 水). Null when the shape is
 * teachable in neither sense, which is the signal that it is NOT a prerequisite.
 */
export function teachablePieceMeaning(glyph: string): string | null {
  const k = kanjiRow(glyph);
  if (k) return k.meanings[0] ?? "";
  const rad = radicalByWrittenForm(glyph);
  if (rad) return rad.meaning;
  const orig = variantOriginal(glyph);
  if (orig !== undefined && orig !== glyph) {
    const ok = kanjiRow(orig);
    if (ok) return ok.meanings[0] ?? "";
    const orad = radicalByWrittenForm(orig);
    if (orad) return orad.meaning;
  }
  return null;
}

/**
 * A kanji's semantic + phonetic pieces (from `builtPieces`) that are themselves
 * teachable — the ones with a kanji card or a radical. Null when the kanji has no
 * etymology pieces at all (a memorised whole) or none of them is teachable, which
 * every caller reads as "there is nothing teachable to say here".
 *
 * A FILTER, not the old all-or-nothing pass, and deliberately so: `builtPieces`
 * has already dropped the form pieces and the pieces Wiktionary cannot account
 * for, so what survives is exactly what the "Built from" tiles show. A piece with
 * no card (a non-jōyō phonetic) is simply not a prerequisite — it is still shown
 * on the tile, but there is nothing to teach it as.
 */
export function teachableParts(glyph: string): KanjiPart[] | null {
  const pieces = builtPieces(glyph);
  if (!pieces.length) return null;
  const out: KanjiPart[] = [];
  for (const p of pieces) {
    const meaning = teachablePieceMeaning(p.glyph);
    if (meaning !== null) out.push({ c: p.glyph, meaning });
  }
  return out.length ? out : null;
}
