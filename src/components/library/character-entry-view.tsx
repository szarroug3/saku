"use client";

// CHARACTER / WORD entry — the ONE redesigned Library page for anything that is a
// glyph or a word, COMPOSED BY ROLE. It shows exactly the blocks the item's roles
// call for, in any combination:
//
//   header
//   As a radical  — the shapes it takes inside other kanji, and where
//   As a kanji    — on'yomi / kun'yomi, then etymology (components + origin)
//   As a word     — how it's said + what it means, the kanji it's written with
//                   (multi-char words), and a sentence it appears in
//   How it's written — single glyphs only (a multi-char word has no one diagram)
//   Used as a part in — when other kanji are built on it
//
// TWO RULES:
//   1. Every block is guarded on ITS OWN content — a pure radical (禾) shows no
//      "As a kanji"/"As a word"; 水 (radical·kanji·word) shows all three; a
//      multi-char word (先生, kind:"word") shows only the word block.
//   2. The accent "As a …" eyebrow appears ONLY when the glyph plays MORE THAN
//      ONE role — with a single role the label is noise (the whole page is that
//      one thing), so the block drops to a bare divider. See RoleBlock.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section, SubLabel } from "@/components/library/entry-section";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { SoundIcon } from "@/components/ui";
import { speak } from "@/lib/speech";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { etymologyOf } from "@/data/kanji-etymology";
import { radicalByGlyph, radicalVariants } from "@/data/radicals";
import { vocabRow } from "@/data/vocab";
import { exampleFor } from "@/data/word-examples";
import { builtPieceEntryId, readingsOf } from "@/lib/library/entries";
import { teachableParts } from "@/lib/kanji-parts";
import { usedAsPartIn } from "@/lib/library/components";
import { entryHref } from "@/lib/library/href";
import { piecesOf, type WordPiece } from "@/lib/library/word-pieces";
import type { ContentItem } from "@/lib/content/item";

const CAP = 5;

type KanjiPiece = Extract<WordPiece, { kind: "kanji" }>;

/** The kanji pieces a multi-char word is written with, and how each is read in it
 * (先 せん · 生 せい). Empty for a jukujikun (大人) or a glyph with no vocab row. */
function wordPiecesOf(glyph: string): KanjiPiece[] {
  const row = vocabRow(glyph);
  if (!row) return [];
  return (piecesOf(row) ?? []).filter(
    (p): p is KanjiPiece => p.kind === "kanji" && p.entry != null,
  );
}

/** One role's block. When the glyph plays SEVERAL roles the block wears an accent
 * "As a …" eyebrow to tell them apart; when it plays only one, the label is noise
 * (the whole page is that one thing) so it drops to a bare divider. */
function RoleBlock({
  title,
  labelled,
  children,
}: {
  title: string;
  labelled: boolean;
  children: React.ReactNode;
}) {
  if (labelled) {
    return (
      <Section title={title} tone="accent">
        {children}
      </Section>
    );
  }
  return <div className="mt-5 border-t border-border/50 pt-5">{children}</div>;
}

// Variant positions in plain English, with the order the section lists them in:
// the un-repositioned form first, then around the character top → left → right →
// bottom. Keyed by the position's romaji (the stable field). A form with no
// position on file reads as "normal" and sorts first — many (麦, 黒, 亀) really
// are the base shape, not a reshaped corner of it.
const POSITION: Record<string, { en: string; rank: number }> = {
  "": { en: "normal", rank: 0 },
  kanmuri: { en: "top", rank: 1 },
  hen: { en: "left", rank: 2 },
  tsukuri: { en: "right", rank: 3 },
  ashi: { en: "bottom", rank: 4 },
  nyou: { en: "bottom-left", rank: 5 },
};

/** The source omits an explicit Position for some forms, but the bushu name
 * usually states it: a name starting した ("below") is a bottom form, one ending
 * がしら/かんむり ("crown") is a top form. Fill ONLY those high-confidence blanks
 * off the name; any other unpositioned form is a base shape used as-is
 * ("normal"). Never contradicts an explicit Position — it only fills a gap. */
function derivePosition(nameKana: string): { en: string; rank: number } {
  if (nameKana.startsWith("した")) return POSITION.ashi;
  if (nameKana.includes("がしら") || nameKana.includes("かんむり")) return POSITION.kanmuri;
  return POSITION[""];
}

/** A variant's position as {en, rank}: the explicit Position when the source has
 * one, else read off the bushu name, else "normal". */
function positionOf(v: {
  position?: { readonly romaji: string; readonly kana: string };
  name: { readonly kana: string };
}): { en: string; rank: number } {
  if (v.position) return POSITION[v.position.romaji] ?? { en: v.position.kana, rank: 6 };
  return derivePosition(v.name.kana);
}

/** A word's readings, and for each the DISTINCT meanings it carries — one string
 * per JMdict sense (its synonym glosses comma-joined), so we can tell "one meaning
 * said several ways" (先生: teacher/instructor/master — one sense) from "several
 * meanings" (two senses under one reading). Sourced from vocab, not the teach-unit
 * meanings (which fold the kanji's core sense onto the primary reading), so 生
 * reads なま → "raw", not "life/raw". Empty when the glyph is not a standalone word. */
interface WordReading {
  readonly reading: string;
  /** One entry per distinct sense; each is that sense's glosses joined. */
  readonly meanings: string[];
}
function wordSensesOf(glyph: string): WordReading[] {
  const row = vocabRow(glyph);
  if (!row) return [];
  const byReading = new Map<string, string[]>();
  for (const s of row.senses) {
    byReading.set(s.reb, [...(byReading.get(s.reb) ?? []), s.glosses.join(", ")]);
  }
  if (byReading.size === 0) byReading.set(row.reb, [row.glosses.join(", ")]);
  return [...byReading].map(([reading, meanings]) => ({ reading, meanings }));
}

/** The components this kanji is built from, each with a short sense. Prefer the
 * etymology's typed components (they carry a semantic/phonetic role); fall back
 * to the plain part breakdown. */
function builtFrom(glyph: string): { glyph: string; sense: string; role?: string }[] {
  const ety = etymologyOf(glyph);
  if (ety && ety.components.length > 0) {
    return ety.components.map((c) => ({ glyph: c.glyph, sense: c.sense ?? "", role: c.function ?? undefined }));
  }
  return (teachableParts(glyph) ?? []).map((p) => ({ glyph: p.c, sense: p.meaning }));
}

/** Readings grouped into on'yomi (from Chinese) and kun'yomi (native), in the
 * data's richest-first order. "both"-typed readings show in each group. */
function readingGroups(
  glyph: string,
): { label: string; help: string; readings: { base: string; example: string }[] }[] {
  const rows = readingsOf(glyph);
  const pick = (t: "on" | "kun") =>
    rows
      .filter((r) => r.type === t || r.type === "both")
      .map((r) => ({ base: r.base, example: r.anchor }));
  return [
    {
      label: "On’yomi",
      help: "A reading borrowed from Chinese, usually taken when several kanji link into a compound word.",
      readings: pick("on"),
    },
    {
      label: "Kun’yomi",
      help: "The native Japanese reading, usually taken when the kanji stands alone or with a hiragana tail.",
      readings: pick("kun"),
    },
  ].filter((g) => g.readings.length > 0);
}

export function CharacterEntryView({
  item,
  lesson = false,
}: {
  item: ContentItem;
  /** LESSON mode. The lesson teaches ONE pronunciation, so the "As a word" block
   * shows only the first reading. Everything else is identical to the Library
   * page — and because the "As a word" lead is driven by what's actually shown,
   * it re-reads correctly on its own (a word with several meanings under that one
   * reading still says "It has multiple meanings"). */
  lesson?: boolean;
}) {
  const glyph = item.glyph;
  const single = [...glyph].length === 1;
  const isKanji = item.roles.includes("kanji");
  const isRadical = item.roles.includes("radical");
  // A multi-character word (先生) is kind:"word" with no role set; a single glyph
  // carries "word" among its roles. Either way it plays the word role here.
  const isWord = item.roles.includes("word") || item.kind === "word";

  const parts = isKanji ? builtFrom(glyph) : [];
  const story = isKanji ? (etymologyOf(glyph)?.originText ?? null) : null;
  const groups = isKanji ? readingGroups(glyph) : [];
  const variants = isRadical ? radicalVariants(glyph) : [];
  const allWordRows = isWord ? wordSensesOf(glyph) : [];
  // The lesson teaches one pronunciation, so it shows one reading; the Library
  // shows every reading. The lead below reads off THIS list, so it stays right.
  const wordRows = lesson ? allWordRows.slice(0, 1) : allWordRows;
  // A multi-char word shows the kanji it's written with; a single glyph doesn't
  // split into itself. The example sentence lives in the word block.
  const wordPieces = isWord && !single ? wordPiecesOf(glyph) : [];
  const example = isWord ? exampleFor(glyph) : null;

  // The DEFINITION belongs to each role, not the header — a glyph that plays
  // several roles can mean different things in each (生 = "life" as a kanji, なま
  // "raw" as a word), so each role block carries its own meaning.
  const kanjiMeaning = isKanji ? (kanjiRow(glyph)?.meanings.join(", ") ?? null) : null;
  const radicalMeaning = isRadical ? (radicalByGlyph(glyph)?.meaning ?? null) : null;

  // Which role blocks have something to show, and whether to LABEL them: a
  // single-role glyph drops the "As a …" label (see RoleBlock). The kanji/word
  // blocks always carry the meaning; the radical block shows only for its variant
  // forms, or — when radical is the SOLE role (a pure radical like 禾) — to carry
  // that radical's meaning, which nothing else would.
  const hasRadical = variants.length > 0 || (isRadical && !isKanji && !isWord);
  const hasKanji = isKanji;
  const hasWord = wordRows.length > 0;
  const labelled = [hasRadical, hasKanji, hasWord].filter(Boolean).length > 1;

  const usedIn = usedAsPartIn(glyph);
  const shownUsedIn = usedIn.slice(0, CAP);
  const restUsedIn = usedIn.length - shownUsedIn.length;

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

        {/* ── AS A RADICAL: its meaning (only when nothing else carries it) and the
              shapes it takes inside other kanji. ── */}
        {hasRadical ? (
          <RoleBlock title="As a radical" labelled={labelled}>
            {!isKanji && radicalMeaning ? (
              <p className={`text-[14px] text-text-muted ${variants.length > 0 ? "mb-4" : ""}`}>
                It means <span className="text-text">{radicalMeaning}</span>.
              </p>
            ) : null}
            {variants.length > 0 ? (
              <>
                <Lead>It takes a different shape depending on where in a kanji it appears:</Lead>
                <table className="text-[15px]">
              <tbody>
                {variants
                  .map((v) => ({
                    v,
                    pos: positionOf(v),
                    example: usedAsPartIn(v.glyph)[0] ?? null,
                  }))
                  .sort((a, b) => a.pos.rank - b.pos.rank)
                  .map(({ v, pos, example }) => (
                    <tr key={v.glyph}>
                      <td className="py-1.5 pr-6 align-middle font-kana text-[24px] leading-none text-text">
                        {v.glyph}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-8 align-middle text-[13px] text-text-muted">
                        {pos.en}
                      </td>
                      <td className="whitespace-nowrap py-1.5 align-middle text-[12px] text-text-muted">
                        {example ? (
                          <>
                            as in{" "}
                            <Link
                              href={entryHref(kanjiEntry(example))}
                              className="font-kana text-[16px] text-text no-underline"
                            >
                              {example}
                            </Link>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </RoleBlock>
        ) : null}

        {/* ── AS A KANJI: its meaning, what it's built from, how it's read, and
              where the shape came from. ── */}
        {hasKanji ? (
          <RoleBlock title="As a kanji" labelled={labelled}>
            <div className="flex flex-col gap-6">
              {kanjiMeaning ? (
                <div>
                  <p className="text-[14px] text-text-muted">
                    It means <span className="text-text">{kanjiMeaning}</span>.
                  </p>
                </div>
              ) : null}
              {parts.length > 0 ? (
                <div>
                  <Lead>It&rsquo;s built from these sub-components:</Lead>
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
                </div>
              ) : null}

              {groups.length > 0 ? (
                <div>
                  <Lead>
                    As a rule of thumb it&rsquo;s read one of these ways. Not a guarantee, but a
                    good guess at how a kanji sounds:
                  </Lead>
                  <div className={`grid gap-x-10 gap-y-6 ${groups.length > 1 ? "sm:grid-cols-2" : ""}`}>
                    {groups.map((g) => (
                      <div key={g.label}>
                        <SubLabel help={g.help}>{g.label}</SubLabel>
                        <table className="w-full text-[14px]">
                          <tbody>
                            {g.readings.map((r) => (
                              <tr key={r.base}>
                                <td className="whitespace-nowrap py-1 pr-6">
                                  <span className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => speak(r.base, "")}
                                      aria-label={`Hear ${r.base}`}
                                      className="flex-none cursor-pointer border-none bg-transparent p-0 leading-none text-accent"
                                    >
                                      <SoundIcon />
                                    </button>
                                    <span className="font-kana text-text">{r.base}</span>
                                  </span>
                                </td>
                                <td className="w-full py-1 align-middle text-[13px] text-text-muted">
                                  as in <span className="font-kana text-[14px]">{r.example}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {story ? (
                <div>
                  <SubLabel>Etymology</SubLabel>
                  <p className="text-[13px] leading-relaxed text-text-muted">{story}</p>
                </div>
              ) : null}
            </div>
          </RoleBlock>
        ) : null}

        {/* ── AS A WORD: how it's said and what it means (a diverging sense shows
              here — 生 なま = raw), the kanji a multi-char word is written with, and
              a real sentence it appears in. ── */}
        {hasWord ? (
          <RoleBlock title="As a word" labelled={labelled}>
            <div className="flex flex-col gap-6">
              <div>
                {/* The lead is DATA-DRIVEN off what's actually shown: several
                    readings → the meaning depends on which; one reading with
                    several meanings → say so; one of each → no lead. In lesson
                    mode wordRows is capped to one reading, so this reads correctly
                    on its own. */}
                {wordRows.length > 1 ? (
                  <Lead>
                    It&rsquo;s read more than one way as a word, and the meaning depends on the
                    pronunciation:
                  </Lead>
                ) : wordRows[0] && wordRows[0].meanings.length > 1 ? (
                  <Lead>It has more than one meaning:</Lead>
                ) : null}
                <table className="w-full text-[14px]">
                  <tbody>
                    {wordRows.map((w) => (
                      <tr key={w.reading}>
                        <td className="whitespace-nowrap py-1 pr-6 align-top">
                          <span className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => speak(w.reading, "")}
                              aria-label={`Hear ${w.reading}`}
                              className="flex-none cursor-pointer border-none bg-transparent p-0 leading-none text-accent"
                            >
                              <SoundIcon />
                            </button>
                            <span className="font-kana text-text">{w.reading}</span>
                          </span>
                        </td>
                        <td className="w-full py-1 align-top text-text-muted">
                          {w.meanings.length > 1
                            ? w.meanings.map((m, i) => (
                                <span key={i} className="block">
                                  {m}
                                </span>
                              ))
                            : w.meanings[0]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {wordPieces.length > 0 ? (
                <div>
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
                </div>
              ) : null}

              {example ? (
                <div>
                  <SubLabel>In a sentence</SubLabel>
                  <p className="font-kana text-[15px] leading-relaxed text-text">{example.jp}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{example.en}</p>
                </div>
              ) : null}
            </div>
          </RoleBlock>
        ) : null}

        {/* Collapsed by default: the "we don't recommend learning to write early"
            notice with a Show button that expands the real stroke diagram. A
            multi-char word has no single diagram, so it's shown for single glyphs
            only (matching the word page's no-stroke stance). */}
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

        {usedIn.length > 0 ? (
          <Section title="Used as a part in">
            <div className="flex flex-col gap-1.5">
              {shownUsedIn.map((c) => (
                <Link
                  key={c}
                  href={entryHref(kanjiEntry(c))}
                  className="flex items-baseline gap-2.5 text-[14px] text-text no-underline"
                >
                  <span className="font-kana text-[18px] leading-none">{c}</span>
                  <span className="min-w-0 flex-1 truncate text-text-muted">
                    {kanjiRow(c)?.meanings.slice(0, 2).join(", ") ?? ""}
                  </span>
                </Link>
              ))}
            </div>
            {restUsedIn > 0 ? (
              <p className="mt-2.5 text-[12px] text-text-muted">· {restUsedIn} more</p>
            ) : null}
          </Section>
        ) : null}
    </EntrySurface>
  );
}
