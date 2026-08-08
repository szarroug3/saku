"use client";

// "Built from" — a kanji taken apart into the pieces Wiktionary's glyph origin
// says it is made of, and what each piece is DOING there.
//
// TWO STACKED SECTIONS IN ONE CARD
// ================================
//   1. HOW IT'S BUILT — the piece tiles. Each is a shape the kanji is drawn from,
//      labelled by the ROLE Wiktionary's glyph origin gives it:
//        - SEMANTIC pieces carry a meaning clue. 河 is water (氵), shown with the
//          sense under the glyph and a quiet "meaning" tag.
//        - PHONETIC pieces carry the sound the kanji takes in compounds. 河 is か,
//          lent by 可, and the tile shows か plus the one everyday word where that
//          sound surfaces (河川, かせん) — a reading you cannot point at in a word
//          is a reading you cannot check.
//        - FORM pieces, and any piece Wiktionary does not account for, are DROPPED:
//          shape with no glyph-origin role, so showing them as "part of the
//          meaning" would be the lie the whole etymology layer refuses.
//   2. ETYMOLOGY — the glyph-origin story in prose, truncated with a More/Less
//      toggle, and a line crediting the English Wiktionary (the word links to the
//      character's own page). Many pictographs (中 = a flagpole with a drum in the
//      center of a field) and shape-drift kanji (丈 = ten 尺 make one 丈) have no
//      mappable pieces yet DO carry a story worth reading, so this section stands
//      on its own — a kanji can show the etymology with no tiles above it.
//
// A separator sits between the two only when BOTH are present. Where there are
// neither tiles nor a story, nothing renders (no empty card), and the number
// kanji 一…十 are always held whole regardless.
//
// SAME LINK-THROUGH AS BEFORE. Each tile links to the piece's own Library page
// (kanji / radical / primitive), via builtPieceEntryId. The shape SHOWN is the
// drawn form (氵); the link resolves to the character it stands for (水).

import Link from "next/link";
import { useId, useState } from "react";

import { Card, Lbl } from "@/components/ui";
import {
  builtPieces,
  etymologyOf,
  phoneticGloss,
  type BuiltPiece,
  type PhoneticGloss,
} from "@/data/kanji-etymology";
import { japaneseFontClass } from "@/lib/japanese-text";
import { teachablePieceMeaning } from "@/lib/kanji-parts";
import type { LibEntry } from "@/lib/library/entries";
import { builtPieceEntryId } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import { phoneticExample } from "@/lib/kanji-onyomi";

/** The line-2 label a piece prints: for a MEANING piece its applicable sense —
 * or, when Wiktionary gave none for this join (河's 氵 carries no contextual
 * gloss), the piece's own meaning (氵 → water), which is the honest "this piece
 * is the water piece". For a SOUND piece the lent reading, left as-is (null shows
 * no reading line). Never invents: a meaning piece with no sense AND no teachable
 * meaning shows nothing. */
function pieceLabel(piece: BuiltPiece): string | null {
  if (piece.role === "phonetic") return piece.label;
  return piece.label ?? teachablePieceMeaning(piece.glyph);
}

/** One piece tile: the glyph, its role label, a quiet role tag, and — for a
 * phonetic piece whose lent reading we know — the everyday word that sound shows
 * up in. A rare, untaught phonetic component also wears an asterisk `marker`
 * keyed to a footnote below. Linked to the piece's own page. */
function PieceTile({
  host,
  piece,
  marker,
}: {
  host: string;
  piece: BuiltPiece;
  /** The asterisk(s) tying this tile to its rare-component footnote, or null for
   * an ordinary piece. */
  marker: string | null;
}) {
  const semantic = piece.role === "semantic";
  const label = pieceLabel(piece);
  // A phonetic piece with a reading also carries the one everyday compound where
  // that reading actually surfaces on the host — 可(か) in 河 shows 運河 (うんが).
  const example =
    !semantic && piece.label ? phoneticExample(host, piece.label) : null;
  return (
    <Link
      href={entryHref(builtPieceEntryId(piece.glyph))}
      className="flex min-w-[5.5rem] flex-1 flex-col items-center gap-1 rounded-lg border border-border bg-card px-3 py-2.5 text-text no-underline hover:bg-panel"
    >
      <span className={`${japaneseFontClass(piece.glyph)} text-[30px] leading-none`}>
        {piece.glyph}
        {marker ? (
          <sup className="ml-0.5 align-super text-[13px] text-text-muted">
            {marker}
          </sup>
        ) : null}
      </span>
      {/* Line 2: the sense (or the piece's own meaning) for a meaning piece, the
          lent reading for a sound piece. A phonetic piece whose reading could not
          be derived shows no reading line — the honest gap the data leaves. */}
      {label ? (
        <span
          className={`text-center text-[12px] leading-tight ${
            semantic ? "text-text-muted" : "font-kana text-accent"
          }`}
        >
          {label}
        </span>
      ) : null}
      {/* Line 3: the role, said plainly. Meaning pieces read muted; sound pieces
          get the quiet accent tag so the two kinds are told apart at a glance
          without shouting. */}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
          semantic
            ? "bg-panel text-text-muted"
            : "bg-accent/10 text-accent"
        }`}
      >
        {semantic ? "meaning" : "phonetic"}
      </span>
      {/* The everyday word the lent sound surfaces in, so the reading is anchored
          to a real compound rather than floating free. */}
      {example ? (
        <span className="text-center text-[11px] leading-tight text-text-muted">
          <span className={japaneseFontClass(example.word)}>{example.word}</span>
          {example.reading ? (
            <span className="font-kana"> ({example.reading})</span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}

/** The Etymology section body: the glyph-origin story, truncated to a couple of
 * lines by default with a More/Less toggle to the full text (short origins show
 * whole, no control), followed by a line crediting the English Wiktionary — the
 * source of the prose — with the character's own page linked. */
function EtymologyBody({ glyph, text }: { glyph: string; text: string }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  // Only prose past a short threshold earns a clamp+toggle; a one-line origin
  // shows whole. Character count, not a line measure — enough to keep the card
  // compact without hiding a sentence.
  const clampable = text.length > 120;
  const wiktionaryUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(glyph)}`;
  return (
    <div>
      <p
        id={panelId}
        className={`text-[13px] leading-relaxed text-text-muted ${
          clampable && !expanded ? "line-clamp-2" : ""
        }`}
      >
        {text}
      </p>
      {clampable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 cursor-pointer rounded border-none bg-transparent p-0 text-[13px] text-accent underline decoration-dotted underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {expanded ? "Less" : "More"}
        </button>
      ) : null}
      <p className="mt-2 text-[11px] text-text-muted">
        From the English{" "}
        <a
          href={wiktionaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-dotted underline-offset-2 hover:opacity-80"
        >
          Wiktionary
        </a>
      </p>
    </div>
  );
}

export function KanjiBuiltFrom({
  entry,
  // The one-line footnote orients the Library, where "Built from" is reference;
  // the lesson mounts the same box under its own "Kanji" heading and has already
  // set the scene, so it turns the line off.
  footnote = true,
}: {
  entry: LibEntry;
  footnote?: boolean;
}) {
  // THE NUMBER KANJI 一…十 render like any other kanji. The old worry — that their
  // shape pieces (六 = 亠 + 八 "eight") mislead — is gone: the etymology layer only
  // tiles pieces Wiktionary calls real, so 三 shows 一+一+一 and 二 shows 一+一
  // (genuine stacked strokes), while 六/四/七/… show their story alone with no
  // false pieces. Their origin prose lives in NUMBERS (kanji-etymology-prose.ts).
  const pieces = builtPieces(entry.glyph);
  const origin = etymologyOf(entry.glyph)?.originText ?? null;
  const hasTiles = pieces.length > 0;
  const hasOrigin = typeof origin === "string" && origin.trim().length > 0;
  // Render only where there is something honest to show: tiles to take the kanji
  // apart, OR — for a pictograph / shape-drift kanji with no mappable pieces — a
  // glyph-origin story to read. Neither ⇒ nothing at all (no empty card).
  if (!hasTiles && !hasOrigin) return null;

  // RARE, UNTAUGHT PHONETIC PIECES get flagged. A sound piece the learner has
  // never met (冓 in 講) reads as a character they should know and don't, so it
  // wears an asterisk keyed to a footnote. `phoneticGloss` is both the trigger
  // (non-null ⇒ rare untaught) and the copy source. Numbered * / ** / *** by
  // order of appearance, so one footnote lines up with each flagged tile.
  const rare = new Map<number, { marker: string; gloss: PhoneticGloss }>();
  pieces.forEach((p, i) => {
    if (p.role !== "phonetic") return;
    const gloss = phoneticGloss(p.glyph);
    if (!gloss) return;
    rare.set(i, { marker: "*".repeat(rare.size + 1), gloss });
  });

  return (
    <Card>
      {/* SECTION 1 — the pieces the kanji is built from. */}
      {hasTiles ? (
        <>
          <Lbl>How it&rsquo;s built</Lbl>
          <div className="flex flex-wrap items-stretch gap-2">
            {pieces.map((p, i) => (
              <PieceTile
                key={`${p.glyph}-${i}`}
                host={entry.glyph}
                piece={p}
                marker={rare.get(i)?.marker ?? null}
              />
            ))}
          </div>
          {footnote ? (
            <p className="mt-2.5 text-xs text-text-muted">
              A <span className="text-text">meaning</span> piece is a clue to what
              the kanji means; a{" "}
              <span className="text-accent">phonetic</span> piece is the sound it
              takes inside words.
            </p>
          ) : null}
          {/* One footnote per rare, untaught sound piece — plain voice, the
              reading in kana (dropped when it couldn't be derived). */}
          {rare.size > 0 ? (
            <div className="mt-2.5 flex flex-col gap-1">
              {pieces.map((p, i) => {
                const flag = rare.get(i);
                if (!flag) return null;
                return (
                  <p key={`fn-${p.glyph}-${i}`} className="text-xs leading-relaxed text-text-muted">
                    <span className="text-text-muted">{flag.marker}</span>{" "}
                    <span className={japaneseFontClass(p.glyph)}>{p.glyph}</span>
                    {flag.gloss.reading ? (
                      <span className="font-kana"> ({flag.gloss.reading})</span>
                    ) : null}{" "}
                    is the sound piece here, but it&rsquo;s a rare character meaning
                    &ldquo;{flag.gloss.meaning}&rdquo;. It&rsquo;s not in our
                    dictionary, so you won&rsquo;t have met it before.
                  </p>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {/* Separator only when both a build and a story are present. */}
      {hasTiles && hasOrigin ? (
        <div className="my-3 border-t border-border" />
      ) : null}

      {/* SECTION 2 — the glyph-origin story, standing on its own for a pictograph
          or shape-drift kanji with no mappable pieces. `hasOrigin` gated a
          non-empty string. */}
      {hasOrigin ? (
        <>
          <Lbl>Etymology</Lbl>
          <EtymologyBody glyph={entry.glyph} text={origin!} />
        </>
      ) : null}
    </Card>
  );
}
