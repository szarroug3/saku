"use client";

// "Built from" — the word taken apart into the pieces that make its sound.
//
// This is the word page's version of the kanji page's stroke diagram: the
// section that shows you the thing is not atomic. 先生 is 先 saying せん and 生
// saying せい, and once you can see that, both characters become readable in
// words you have never met.
//
// EVERY KANJI PIECE LINKS. That is the payoff — the piece is an entry with a
// page, and following it is how a word becomes a way into the characters.
//
// THE TAIL DOES NOT LINK, AND SAYS WHY. Okurigana is not an entry; there is no
// page for きる. But rendering it merely "different" (dimmer, unlinked) teaches
// nothing — the reader sees something greyed out and concludes it is less
// important, when in fact it is the part that decides the word. 生きる and
// 生まれる differ in nothing else. So it is labelled in words: "okurigana — the
// part that changes".

import Link from "next/link";

import { Card, Lbl } from "@/components/ui";
import { entryHref } from "@/lib/library/href";
import { compoundNote, type WordPiece } from "@/lib/library/word-pieces";

function KanjiPiece({ piece }: { piece: Extract<WordPiece, { kind: "kanji" }> }) {
  const inner = (
    <>
      <span className="text-[30px] leading-none">{piece.written}</span>
      <span className="text-[12px] text-text-muted">{piece.reading}</span>
    </>
  );
  const className =
    "flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 no-underline";
  // A piece whose kanji the app has no page for still PRINTS — it is part of the
  // word, and dropping it would misspell the word to avoid a dead link.
  if (!piece.entry) {
    return <span className={`${className} text-text`}>{inner}</span>;
  }
  return (
    <Link href={entryHref(piece.entry)} className={`${className} text-text hover:bg-panel`}>
      {inner}
    </Link>
  );
}

export function WordBuiltFrom({ pieces }: { pieces: readonly WordPiece[] }) {
  const note = compoundNote(pieces);
  const tail = pieces.some((p) => p.kind === "kana" && p.okurigana);

  return (
    // A column, because the page pairs this box with the Links card in a row of
    // one shared height: when this is the shorter of the two the notes below go
    // to the bottom edge rather than floating in the middle of the dead space.
    <Card className="flex h-full flex-col">
      <Lbl>Built from</Lbl>
      <div className="flex flex-wrap items-stretch gap-2">
        {pieces.map((p, i) =>
          p.kind === "kanji" ? (
            <KanjiPiece key={i} piece={p} />
          ) : (
            <span
              key={i}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border px-3 py-2"
            >
              <span className="text-[30px] leading-none text-text-muted">{p.text}</span>
              {p.okurigana ? (
                <span className="text-[12px] text-text-muted">okurigana</span>
              ) : null}
            </span>
          ),
        )}
      </div>

      {/* The footnotes, pinned to the foot. */}
      <div className="mt-auto">
        {tail ? (
          <p className="mt-2.5 text-xs text-text-muted">
            The dashed piece is <b className="text-text">okurigana</b> — the part
            that changes. The kanji stays put and the tail decides which word it
            is.
          </p>
        ) : null}

        {/* Rendered ONLY when every piece resolved. A half-known compound gets
            no sentence rather than a hedged one — see compoundNote, which
            returns null the moment one reading is ambiguous. */}
        {note ? <p className="mt-2 text-xs text-text-muted">{note}</p> : null}
      </div>
    </Card>
  );
}
