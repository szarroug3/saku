"use client";

// WORD entry — the redesigned Library page for one multi-character word (先生,
// 大人). A word plays a single role, so it needs no per-role split; it shows what
// a reader wants from a word: how it's said and what it means, what kanji it is
// written with (and how each is read in it), and a real sentence it appears in.
//
//   header
//   Meaning         — every reading of the word with its gloss(es)
//   Built from      — the kanji pieces + the reading each contributes (先 せん · 生 せい)
//   In a sentence   — a corpus example, when we have one
//
// Reference data only, read off the vocab row + the verified per-kanji reading
// alignment (piecesOf) + the chosen example (exampleFor). No stroke section: a
// multi-kanji word has no single diagram — each kanji's is on its own page.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import { SoundIcon } from "@/components/ui";
import { kanjiRow } from "@/data/kanji";
import { vocabRow } from "@/data/vocab";
import { exampleFor } from "@/data/word-examples";
import { speak } from "@/lib/speech";
import { entryHref } from "@/lib/library/href";
import { piecesOf, type WordPiece } from "@/lib/library/word-pieces";
import type { ContentItem } from "@/lib/content/item";

type KanjiPiece = Extract<WordPiece, { kind: "kanji" }>;

/** The word's senses, one row per reading with its glosses merged. */
function sensesOf(glyph: string): { reading: string; meaning: string }[] {
  const row = vocabRow(glyph);
  if (!row) return [];
  const byReading = new Map<string, string[]>();
  for (const s of row.senses) {
    byReading.set(s.reb, [...(byReading.get(s.reb) ?? []), ...s.glosses]);
  }
  if (byReading.size === 0) byReading.set(row.reb, [...row.glosses]);
  return [...byReading].map(([reading, gl]) => ({
    reading,
    meaning: [...new Set(gl)].join(", "),
  }));
}

export function WordEntryView({ item }: { item: ContentItem }) {
  const row = vocabRow(item.glyph);
  if (!row) return null;
  const senses = sensesOf(item.glyph);
  // Only the kanji pieces carry a per-kanji reading worth showing; a kana tail
  // (見る → 見 + る) has nothing to break down. Absent for a jukujikun (大人).
  const pieces = (piecesOf(row) ?? []).filter(
    (p): p is KanjiPiece => p.kind === "kanji" && p.entry != null,
  );
  const example = exampleFor(item.glyph);

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      <Section title="Meaning" tone="accent">
        <Lead>How the word is said, and what it means:</Lead>
        <table className="w-full text-[14px]">
          <tbody>
            {senses.map((s) => (
              <tr key={s.reading}>
                <td className="whitespace-nowrap py-1 pr-6 align-top">
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => speak(s.reading, "")}
                      aria-label={`Hear ${s.reading}`}
                      className="flex-none cursor-pointer border-none bg-transparent p-0 leading-none text-accent"
                    >
                      <SoundIcon />
                    </button>
                    <span className="font-kana text-text">{s.reading}</span>
                  </span>
                </td>
                <td className="w-full py-1 align-top text-text-muted">{s.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {pieces.length > 0 ? (
        <Section title="Built from" tone="accent">
          <Lead>The kanji it&rsquo;s written with, and how each is read here:</Lead>
          <table className="w-full text-[14px]">
            <tbody>
              {pieces.map((p, i) => (
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

      {example ? (
        <Section title="In a sentence">
          <p className="font-kana text-[15px] leading-relaxed text-text">{example.jp}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{example.en}</p>
        </Section>
      ) : null}
    </EntrySurface>
  );
}
