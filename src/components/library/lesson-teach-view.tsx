"use client";

// LESSON (teach) views — the TRIMMED counterpart to the Library entry pages.
//
// A Library page is a REFERENCE: it shows everything true about an item — every
// on'yomi/kun'yomi, the etymology, every word sense, "used as a part in", variant
// forms. A LESSON teaches LESS, because a lesson teaches ONE teaching unit, not the
// whole item: the word 先生 is taught as せんせい = teacher; a many-reading kanji is
// taught as its primary reading + core meaning. So a teach card shows only what
// that one unit needs — the glyph, THE reading being taught + its meaning(s), a
// short "Built from" for context, and the collapsed "How it's written" — and omits
// the exhaustive reference tables the Library page carries.
//
// Same visual language as the Library pages (EntrySurface / Section / the shared
// header + HowItsWritten), so a lesson and a reference read as one app; the teach
// card is simply a shorter page in it.
//
// Kana are the exception the owner named: a kana lesson teaches exactly what its
// Library page shows (glyph, sound hook, stroke order), so KanaTeachView is the
// kana Library view unchanged.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import { KanaEntryView } from "@/components/library/kana-entry-view";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { SoundIcon } from "@/components/ui";
import { kanjiRow } from "@/data/kanji";
import { etymologyOf } from "@/data/kanji-etymology";
import { vocabRow } from "@/data/vocab";
import { builtPieceEntryId } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import { teachableParts } from "@/lib/kanji-parts";
import { piecesOf, type WordPiece } from "@/lib/library/word-pieces";
import { speak } from "@/lib/speech";
import type { ContentItem } from "@/lib/content/item";
import type { PronunciationUnit } from "@/lib/content/teach-unit";

type KanjiPiece = Extract<WordPiece, { kind: "kanji" }>;

/** The components a single kanji glyph is built from, each with a short sense.
 * Prefers the etymology's typed components (they carry a semantic/phonetic role);
 * falls back to the plain part breakdown. Same source as the Library page's
 * Built-from, kept short — context for the reading being taught, not a study of
 * the glyph's construction. */
function builtFromGlyph(glyph: string): { glyph: string; sense: string; role?: string }[] {
  const ety = etymologyOf(glyph);
  if (ety && ety.components.length > 0) {
    return ety.components.map((c) => ({
      glyph: c.glyph,
      sense: c.sense ?? "",
      role: c.function ?? undefined,
    }));
  }
  return (teachableParts(glyph) ?? []).map((p) => ({ glyph: p.c, sense: p.meaning }));
}

/** The kanji pieces a multi-char word is written with, and how each is read in it
 * (先 せん · 生 せい). Empty for a jukujikun (大人) or a glyph with no vocab row. */
function builtFromWord(glyph: string): KanjiPiece[] {
  const row = vocabRow(glyph);
  if (!row) return [];
  return (piecesOf(row) ?? []).filter(
    (p): p is KanjiPiece => p.kind === "kanji" && p.entry != null,
  );
}

/**
 * The trimmed teach card for a CHARACTER or WORD, teaching ONE pronunciation unit.
 * Shows the header (glyph + the taught meaning), "How you say it" (the one reading
 * + its meaning), an optional "Built from", and the collapsed "How it's written".
 * When `unit.reading` is null (a meaning-only unit) it shows the meaning with no
 * reading and no sound.
 */
export function CharacterTeachView({
  item,
  unit,
}: {
  item: ContentItem;
  unit: PronunciationUnit;
}) {
  const glyph = item.glyph;
  const single = [...glyph].length === 1;
  const meaning = unit.meanings.map((m) => m.label).join(", ");

  // Built-from context: a single glyph shows its kanji components; a multi-char
  // word shows the kanji it's written with and how each reads here.
  const parts = single ? builtFromGlyph(glyph) : [];
  const wordPieces = single ? [] : builtFromWord(glyph);

  const isKanji = item.roles.includes("kanji");

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      {/* ── HOW YOU SAY IT: the ONE reading this lesson teaches, and what it
            means. A meaning-only unit (reading null) shows the meaning alone. ── */}
      <Section title="How you say it" tone="accent">
        {unit.reading ? (
          <>
            <Lead>The word is said this way, and this is what it means:</Lead>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => speak(unit.reading ?? "", "")}
                aria-label={`Hear ${unit.reading}`}
                className="flex-none cursor-pointer border-none bg-transparent p-0 leading-none text-accent"
              >
                <SoundIcon />
              </button>
              <span className="font-kana text-[22px] leading-none text-text">{unit.reading}</span>
              {meaning ? (
                <span className="ml-3 text-[14px] text-text-muted">{meaning}</span>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <Lead>This is what it means:</Lead>
            <p className="text-[15px] text-text">{meaning || glyph}</p>
          </>
        )}
      </Section>

      {/* ── BUILT FROM: short context for the reading — the pieces the glyph (or
            word) is made of. Guarded on content; omitted when there's nothing. ── */}
      {parts.length > 0 ? (
        <Section title="Built from" tone="accent">
          <Lead>It&rsquo;s built from these pieces:</Lead>
          <div className="flex flex-col gap-1.5">
            {parts.map((p) => (
              <Link
                key={p.glyph}
                href={entryHref(builtPieceEntryId(p.glyph))}
                className="flex items-baseline gap-2.5 text-[14px] text-text no-underline"
              >
                <span className="font-kana text-[18px] leading-none">{p.glyph}</span>
                <span className="min-w-0 flex-1 truncate text-text-muted">{p.sense}</span>
                {p.role && p.role !== "semantic" ? (
                  <span className="text-[10px] uppercase tracking-[0.05em] text-text-muted/70">
                    {p.role}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </Section>
      ) : wordPieces.length > 0 ? (
        <Section title="Built from" tone="accent">
          <Lead>The kanji it&rsquo;s written with, and how each is read here:</Lead>
          <table className="w-full text-[14px]">
            <tbody>
              {wordPieces.map((p, i) => (
                <tr key={`${p.char}-${i}`}>
                  <td className="whitespace-nowrap py-1 pr-4 align-middle">
                    <Link
                      href={entryHref(p.entry!)}
                      className="flex items-baseline gap-2.5 text-text no-underline"
                    >
                      <span className="font-kana text-[20px] leading-none">{p.written}</span>
                      <span className="font-kana text-[14px] text-accent">{p.reading}</span>
                    </Link>
                  </td>
                  <td className="w-full py-1 align-middle text-[13px] text-text-muted">
                    {kanjiRow(p.char)?.meanings.slice(0, 2).join(", ") ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {/* Collapsed by default, exactly as on the Library page (no alwaysOpen). A
          multi-char word has no single stroke diagram, so — like the word Library
          page — it carries no stroke section at all. */}
      {single ? (
        <div className="mt-5 border-t border-border/50 pt-5">
          <HowItsWritten
            item={{
              entry: item.entry,
              glyph,
              kind: isKanji ? "kanji" : "radical",
              facts: item.facts.map((f) => f.id),
            }}
          />
        </div>
      ) : null}
    </EntrySurface>
  );
}

/**
 * The kana teach view. The owner's line: a kana lesson teaches exactly what the
 * kana Library page shows, so this IS that page.
 */
export function KanaTeachView({ item }: { item: ContentItem }) {
  return <KanaEntryView item={item} />;
}
