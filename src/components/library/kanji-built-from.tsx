"use client";

// "Built from" — a kanji taken apart into the pieces Wiktionary's glyph origin
// says it is made of, and what each piece is DOING there.
//
// WHAT CHANGED, AND WHY
// =====================
// This used to show the full KanjiVG SHAPE decomposition — every drawn piece,
// radicals included, glyph over meaning. That answered "what strokes is this
// drawn from" but not the more useful question a learner actually has: which
// piece carries the MEANING and which one is only there for the SOUND. The
// etymology layer (src/data/kanji-etymology.ts, builtPieces) answers that, joining
// Wiktionary's per-component function onto the app's own shapes, so this section
// now teaches structure instead of stroke-assembly:
//
//   - SEMANTIC pieces carry a meaning clue. 河 is water (氵), and the section says
//     so with the sense under the glyph and a quiet "meaning" tag.
//   - PHONETIC pieces carry the sound the kanji takes in compounds. 河 is か, lent
//     by 可, and the tile shows the reading か plus the one everyday word where
//     that sound surfaces (河川, かせん) — because a reading you cannot point at in
//     a word is a reading you cannot check.
//   - FORM pieces, and any piece Wiktionary does not account for, are DROPPED.
//     They are shape with no glyph-origin role, and showing them as "part of the
//     meaning" would be the lie the whole etymology layer refuses.
//
// NO TILES, BUT A STORY STILL COUNTS. Where builtPieces is empty this used to
// render nothing at all. But a great many pictographs (中 = a flagpole with a
// drum in the center of a field) and shape-drift kanji (丈 = ten 尺 make one 丈)
// have no mappable pieces yet DO carry a glyph-origin story in
// `etymologyOf(glyph).originText`, and that story genuinely aids memory. So:
//   - PIECES present → tiles, exactly as before, with the origin prose folded
//     behind the collapsed "Why?" (it often runs long alongside tiles).
//   - NO pieces but originText present → the section still renders, this time
//     with NO tiles and the origin prose shown DIRECTLY as the body, because the
//     whole point is to read it, not to toggle it open. See OriginProse below.
//   - NEITHER → nothing at all (no empty card), and the number kanji 一…十 are
//     always held whole regardless.
//
// SAME LINK-THROUGH AS BEFORE. Each tile still links to the piece's own Library
// page (kanji / radical / primitive), via the id-resolution the shape
// decomposition always used (builtPieceEntryId). The shape SHOWN is the drawn
// form (氵); the link resolves to the character it stands for (水).

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
import { isNumberKanji } from "@/data/number-kanji";
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

/** The glyph-origin prose, ALWAYS behind a collapsed "Why?" — many run long, so
 * none goes inline. Reuses the dotted-underline "Why?" toggle and muted body of
 * the shared WhyDisclosure (src/components/lesson/why.tsx), but takes a plain
 * per-kanji string rather than static data from src/data/why.ts. */
function WhyOrigin({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer rounded border-none bg-transparent p-0 text-[13px] text-accent underline decoration-dotted underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {open ? "Less" : "Why?"}
      </button>
      {open ? (
        <p id={panelId} className="mt-2 text-[13px] leading-relaxed text-text-muted">
          {text}
        </p>
      ) : null}
    </div>
  );
}

/** The glyph-origin prose shown DIRECTLY as the section body, for a kanji that
 * has a story but no mappable pieces (中, 上, 丈). Unlike WhyOrigin this defaults
 * VISIBLE — the owner wants to read it, not toggle it open. Long lines (some
 * origins run scholarly and long) soft-clamp to a few lines with a "Show more"
 * control, so the section stays readable at a glance without ballooning the card;
 * short ones show whole with no control. */
function OriginProse({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  // Only long prose earns a clamp+toggle; short origins (上's one line) show
  // whole. The threshold is a rough character count, not a line measure — enough
  // to keep the card compact without hiding a sentence or two.
  const clampable = text.length > 180;
  return (
    <div className="mt-1">
      <p
        id={panelId}
        className={`text-[13px] leading-relaxed text-text-muted ${
          clampable && !expanded ? "line-clamp-4" : ""
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
          className="mt-1.5 cursor-pointer rounded border-none bg-transparent p-0 text-[13px] text-accent underline decoration-dotted underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
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
  // THE NUMBER KANJI 一…十 ARE MEMORISED WHOLES, always, even where Wiktionary
  // does decompose them (三 as three 一): their shape-only pieces imply a meaning
  // the number does not carry, so — exactly as the old shape decomposition did —
  // they show NO Built from. Every other kanji keeps whatever pieces it has.
  if (isNumberKanji(entry.glyph)) return null;
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
      <Lbl>How it&rsquo;s built &amp; etymology</Lbl>
      {hasTiles ? (
        <>
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
          {/* One footnote per rare, untaught sound piece — plain American voice,
              the reading in kana (dropped when it couldn't be derived). */}
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
                    &ldquo;{flag.gloss.meaning}&rdquo; — it&rsquo;s not in our
                    dictionary, so you won&rsquo;t have met it before.
                  </p>
                );
              })}
            </div>
          ) : null}
          {/* Tiles present: the origin prose stays folded behind "Why?" — it
              often runs long alongside the tiles. */}
          {origin ? <WhyOrigin text={origin} /> : null}
        </>
      ) : (
        // No mappable pieces, but a glyph-origin story: show it directly as the
        // body. `hasOrigin` gated the render, so `origin` is a non-empty string.
        <OriginProse text={origin!} />
      )}
    </Card>
  );
}
