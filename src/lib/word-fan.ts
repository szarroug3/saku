// Where a form stops being the word and starts being the change.
//
// The fan prints 間違えます beside 間違える and has to make ONE thing visible: the
// stem 間違え is the word, and ます is what was done to it. That is the whole
// content of the card — "this is the part that changes" — and it is a typesetting
// job, so what this file returns is a split, not a sentence.
//
// THE SPLIT IS THE LONGEST COMMON PREFIX, AND NOTHING CLEVERER
// ============================================================
// No conjugation rules are re-derived here. The engine already produced both
// strings; the only question left is where they stop agreeing, and the answer to
// that is a prefix scan. A rule-based splitter would be a second, worse copy of
// the conjugation engine living in the view layer, and it would disagree with
// the engine on exactly the irregular verbs where being right matters.
//
// IT DEGRADES HONESTLY. する → した shares no prefix at all, and the whole of した
// comes back as the changed part. That is TRUE — nothing of する survived — and a
// splitter that tried to preserve a stem there would be inventing one. 来る →
// 来た keeps 来, which is also true and is what a reader sees.
//
// CODE POINTS, NOT UTF-16 UNITS. Japanese is entirely in the BMP so `.length`
// would work today, but a split that can land inside a surrogate pair is a
// mojibake bug waiting for the first word with one in it, and iterating the
// string costs nothing at these lengths.

/** A form, cut into the part that stayed and the part that changed. */
export interface StemSplit {
  /** The leading run the form shares with the dictionary form. May be empty. */
  readonly stem: string;
  /** Everything after it — what this form added or replaced. May be empty, for
   * a form identical to the dictionary form. */
  readonly tail: string;
}

/**
 * Split `value` against the word's dictionary form.
 *
 * The stem is their longest common prefix; the tail is the rest of `value`. The
 * dictionary form's own leftovers are deliberately NOT reported: the card shows
 * where each branch ENDS UP, not a subtraction, and printing "minus る plus ます"
 * would be a second grammar lesson on a card whose brief is one sentence long.
 */
export function stemSplit(dictionary: string, value: string): StemSplit {
  const a = [...dictionary];
  const b = [...value];
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return { stem: b.slice(0, i).join(""), tail: b.slice(i).join("") };
}
