// SAK-30: whether a RELATED cross-link or a "commonly mixed up with" call-out
// points somewhere the learner has actually been. Both are cross-references a
// Library entry page draws BEFORE the learner asked for them — a term's
// `related` list, a kana's shape lookalikes — and both were pointing at
// material the learner had never been taught: the Hiragana term card linked
// Katakana and Dakuten at lesson-1 card-2, か's "commonly mixed up with"
// showed カ before katakana had been introduced at all.
//
// NO NEW PROGRESSION SYSTEM. `startedTracks` (src/lib/track-open.ts) already
// answers "has this track been touched at all" off history alone — the exact
// signal the track-intro cards gate on — and it is reused here rather than
// invented twice. The bar is deliberately LOW: "has the learner been shown
// this at all", not "claimed" and not "mastered". A learner who has met one
// katakana fact has katakana "reachable" for the rest of the app, the same
// moment the katakana track intro would have already fired for them.
//
// TWO SHAPES OF CONCEPT
// ======================
// A RELATED/mix-up-with link never names a fact directly — it names a TERM
// (hiragana, katakana, dakuten, …, the glossary in data/terms.ts), a MARK
// (dakuten, handakuten, data/marks.ts) or a KANA glyph (カ). So there are two
// ways a concept id resolves to "taught":
//
//   TRACK CONCEPTS   — the id names a whole TrackId (katakana) or stands in
//                       for one (kana/hiragana both ride on the hiragana
//                       track, since kana opens the moment hiragana does).
//                       Reachable once that whole track has started.
//   DECORATION CONCEPTS — dakuten/handakuten are not tracks of their own; they
//                       are a handful of kana WITHIN hiragana/katakana (が,
//                       ば, …). Gating them on "hiragana started" would let
//                       Dakuten through at lesson-1 card-2 same as any other
//                       hiragana fact, which is the exact bug SAK-30 reports.
//                       So these gate on "has the learner met ANY kana that
//                       carries the mark" — the first moment the concept
//                       genuinely exists on screen.
//
// A bare kana glyph (カ) gates the same way a track concept does: which track
// its own script belongs to (trackOf), started or not.
//
// UNKNOWN CONCEPTS ARE NOT GATED. A term with no entry here (romaji, jlpt, …)
// renders exactly as before — this module only holds an opinion about the
// concepts SAK-30 named a problem for, not a blanket allowlist of everything
// a Library page might ever link to.

import { CHAR_INDEX, KANA_SUBJECT, kanaFact } from "@/data/characters";
import { DAKUTEN_ROWS } from "@/data/dakuten-rows";
import type { TrackId } from "@/data/track-intros";
import { effectiveState } from "@/lib/claims";
import { startedTracks, trackOf } from "@/lib/track-open";
import type { HistoryFile } from "@/types";

/** Glossary/mark ids that stand for a whole track — "katakana" for both the
 * term and the mark id spaces share this shape, so one map covers both. `kana`
 * and `hiragana` both ride on the hiragana track: kana-the-concept has nothing
 * to say until hiragana, its first half, has started. */
const TRACK_CONCEPT: Readonly<Record<string, TrackId>> = {
  kana: "hiragana",
  hiragana: "hiragana",
  katakana: "katakana",
};

/** Every glyph a dakuten/handakuten mark actually lands on, e.g.
 * `{ dakuten: ["が", "ざ", …, "ガ", "ザ", …], handakuten: ["ぱ", …, "パ", …] }`
 * — built off DAKUTEN_ROWS so a new row is picked up automatically. Keyed by
 * `markName`, which is also the term id AND the mark id ("dakuten",
 * "handakuten") — one string names all three, so one map serves both link
 * spaces. */
const DECORATION_GLYPHS: ReadonlyMap<string, readonly string[]> = (() => {
  const byMark = new Map<string, string[]>();
  for (const row of DAKUTEN_ROWS) {
    const list = byMark.get(row.markName) ?? [];
    for (const [, converted] of row.pairs) list.push(converted);
    byMark.set(row.markName, list);
  }
  return byMark;
})();

/** Has any fact of this kana glyph's own entry ever been met — answered,
 * claimed, or asked to be quizzed on. The same `effectiveState`/`lastTested`
 * rule track-open.ts's own `met` uses, aimed at one glyph's entry instead of
 * folded across a whole track: a decoration concept needs to know WHICH
 * glyphs, not just which script. `kanaFact` mints the real id (data/
 * characters.ts) rather than reconstructing the `<entry>/<aspect>` grammar
 * here — see fact-id.ts's own rule against parsing or hand-building one. */
function kanaMet(glyph: string, history: HistoryFile): boolean {
  const fact = kanaFact(glyph);
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested !== 0;
}

/** Has the learner met any kana from this list — the low bar `startedTracks`
 * also uses ("has this been shown at all"), just aimed at a handful of
 * glyphs instead of a whole track. */
function anyKanaMet(glyphs: readonly string[], history: HistoryFile): boolean {
  return glyphs.some((g) => kanaMet(g, history));
}

/**
 * Whether a RELATED link or a "commonly mixed up with" call-out for this
 * concept id should show at all — the SAK-30 gate. `id` is a bare id in ONE of
 * the three id spaces a Library page links through: a term id (dakuten), a
 * mark id (dakuten — the same string, deliberately), or a kana glyph (カ, via
 * `kanaGlyphReachable` below).
 *
 * Not itself an EntryId lookup: entry ids are prefixed (`kana:カ`,
 * `term:dakuten`) and callers already have the bare id they minted the entry
 * from, so asking for that avoids a parse-the-id step this app otherwise
 * never does (see href.ts's own rule against it).
 */
export function conceptReachable(id: string, history: HistoryFile): boolean {
  const track = TRACK_CONCEPT[id];
  if (track) return startedTracks(history, new Set()).has(track);

  const glyphs = DECORATION_GLYPHS.get(id);
  if (glyphs) return anyKanaMet(glyphs, history);

  return true;
}

/** Whether a bare KANA GLYPH's own script is reachable — カ gates on
 * "katakana has started", not on カ itself having been met (that would make
 * a lookalike call-out unable to ever warn about a mix-up before it happens
 * — see the module header). Non-kana glyphs (kanji, radicals) are not gated
 * here; SAK-30 only reported the kana case, and a kanji's own confusables
 * have no equivalent track concept to gate on. */
export function kanaGlyphReachable(glyph: string, history: HistoryFile): boolean {
  if (CHAR_INDEX[glyph] === undefined) return true;
  const track = trackOf(KANA_SUBJECT, glyph);
  if (!track) return true;
  return startedTracks(history, new Set()).has(track);
}
