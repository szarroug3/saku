// A sentence that mixes Japanese and English, drawn run by run (SAK-443).
//
// Everywhere else in the Sky a string is one thing: a glyph, a reading, a list
// of words, and `japaneseFont(text)` picks the face for all of it. Prose is
// not one thing. いいえ's contrast note is English with two Japanese words in
// it, and the single class drew the English in the Japanese face too, so the
// note sat on the page in a different type from the sentences around it.
//
// Use this for authored prose: a note, a hint, a paragraph of the teaching.
// Keep `japaneseFont` for the strings that really are one face.

import { mixedRuns } from "@/sky/lib/japanese";

export function Mixed({ text }: { text: string }) {
  return (
    <>
      {mixedRuns(text).map((run, i) =>
        run.japanese ? <span key={i} className="font-kana">{run.text}</span> : <span key={i}>{run.text}</span>,
      )}
    </>
  );
}
