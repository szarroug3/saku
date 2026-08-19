// Splitting a WHOLE SENTENCE into furigana-ready segments, from the per-kanji
// `kr` breakdown scripts/ingest/sentence_readings.py adds to word-examples.json
// (SAK-95). This is the sentence-level sibling of word-pieces.ts's `piecesOf()`
// — same [kanji, surface-reading, base-reading] triple shape, same refusal to
// guess — but a DIFFERENT failure policy at the edges, because the two operate
// at different granularity.
//
// piecesOf() refuses the WHOLE WORD the moment one kanji can't be placed: a
// word page's "built from" table is a claim about every piece, and a partial
// claim reads as a wrong one. A sentence is not that: it is running prose with
// many independent words in it, and a jukujikun or an unresolved reading on
// ONE of them (明日/あす in an otherwise ordinary sentence) is not a reason to
// strip furigana from every OTHER kanji in the sentence. So here, a null slot
// renders that one character bare — no ruby, no guess — while its neighbours
// still get theirs. Absent per kanji, not absent per sentence.

import type { KanjiReadingSlot } from "@/data/word-examples";

function isKanjiChar(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    cp === 0x3005 // 々, the iteration mark
  );
}

/** One segment of a sentence, ready to render. */
export type SentenceSegment =
  | {
      readonly kind: "kanji";
      readonly char: string;
      /** The in-context reading, or null when it could not be determined —
       * render the bare character with no ruby, never a guess. */
      readonly reading: string | null;
    }
  | { readonly kind: "text"; readonly text: string };

/**
 * Walk `jp` character by character, pairing each kanji with its reading from
 * `kr` (one slot per kanji character, in the same left-to-right order — see
 * scripts/ingest/sentence_readings.py). Runs of non-kanji text (kana,
 * punctuation, spaces) are collapsed into single "text" segments so the
 * renderer isn't asked to key one <span> per kana character.
 *
 * `kr` is trusted to have exactly one slot per kanji character in `jp` — the
 * ingest script and this walk are built from the same character classifier —
 * but a length mismatch (a stale artifact, a hand-edited fixture) degrades to
 * unread kanji rather than throwing: every kanji past the end of `kr` reads as
 * `reading: null`.
 */
export function sentencePiecesOf(
  jp: string,
  kr: readonly KanjiReadingSlot[],
): readonly SentenceSegment[] {
  const out: SentenceSegment[] = [];
  let ki = 0;
  let pendingText = "";

  const flushText = () => {
    if (pendingText) {
      out.push({ kind: "text", text: pendingText });
      pendingText = "";
    }
  };

  for (const ch of jp) {
    if (isKanjiChar(ch)) {
      flushText();
      const slot = kr[ki];
      ki++;
      out.push({ kind: "kanji", char: ch, reading: slot ? slot[1] : null });
    } else {
      pendingText += ch;
    }
  }
  flushText();
  return out;
}
