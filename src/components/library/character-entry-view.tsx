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
//
// The Library path fetches a full display-ready payload by entry id. The live
// teach/dev adapter supplies that same payload synchronously beside its item, so
// those already-heavy routes never add a network pause and this module itself
// stays free of runtime imports from the curriculum dictionary.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { ConfusionSection } from "@/components/library/confusion-section";
import { EntrySurface, Lead, Section, SubLabel } from "@/components/library/entry-section";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { HearButton } from "@/components/ui/hear-button";
import type { CharacterEntryPayload } from "@/lib/library/character-entry-content";
import { useContentEntry } from "@/lib/library/content-entries";
import { entryHref } from "@/lib/library/href";
import type { ContentItem } from "@/lib/content/item";
import type { EntryId } from "@/types";

const CAP = 5;

/**
 * Register/formality annotation copy for a word sense (SAK-32).
 *
 * Fixed template per tag, not a per-word sentence: the text describes the
 * REGISTER, not the word's specific meaning, so it reads correctly whether
 * the tagged sense glosses to "yes" or "bag". Sourced from JMdict `<misc>`
 * tags per sense (see wordSenseRegister in @/data/vocab) and applied
 * PER SENSE, never promoted to the whole word or reading: a word can have
 * one sense tagged and a sibling sense untagged, and only the tagged one
 * shows a line. Approved copy, final (Sam sign-off 2026-08-19) — do not
 * reword. Ordered most to least formal; a sense with more than one tag shows
 * every applicable line in this order.
 */
const REGISTER_COPY: Record<string, string> = {
  honorific:
    "Honorific. Raises the person being talked about, for someone else's actions, not your own.",
  humble:
    "Humble. Lowers yourself, for your own actions, to show respect to the listener.",
  polite: "Polite. The safe, formal register, used with people you don't know well.",
  familiar: "Familiar. Casual language for people you're close to.",
  colloquial: "Colloquial. Common in speech, not formal writing.",
};

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

export function CharacterEntryView({
  entry,
  item,
  live,
  lesson = false,
}: {
  entry?: EntryId;
  item?: ContentItem;
  /** Exact live derivation supplied by the lesson/dev adapter. Kept separate so
   * this Library-route module has no runtime edge to the heavy source data. */
  live?: CharacterEntryPayload;
  /** LESSON mode. The lesson teaches ONE pronunciation, so the "As a word" block
   * shows only the first reading. Everything else is identical to the Library
   * page — and because the "As a word" lead is driven by what's actually shown,
   * it re-reads correctly on its own (a word with several meanings under that one
   * reading still says "It has multiple meanings"). */
  lesson?: boolean;
}) {
  const fetched = useContentEntry<CharacterEntryPayload>(item ? null : (entry ?? null));
  const payload = item ? live : fetched;
  if (payload === undefined || payload === null) return null;

  item = payload.item;
  const glyph = item.glyph;
  const single = [...glyph].length === 1;
  const isKanji = item.roles.includes("kanji");
  const isRadical = item.roles.includes("radical");
  // A multi-character word (先生) is kind:"word" with no role set; a single glyph
  // carries "word" among its roles. Either way it plays the word role here.
  const isWord = item.roles.includes("word") || item.kind === "word";

  const { parts, story, groups, variants, wordRows: allWordRows } = payload;
  // The lesson teaches one pronunciation, so it shows one reading; the Library
  // shows every reading. The lead below reads off THIS list, so it stays right.
  const wordRows = lesson ? allWordRows.slice(0, 1) : allWordRows;
  // A multi-char word shows the kanji it's written with; a single glyph doesn't
  // split into itself. The example sentence lives in the word block.
  const { wordPieces, example } = payload;

  // The DEFINITION belongs to each role, not the header — a glyph that plays
  // several roles can mean different things in each (生 = "life" as a kanji, なま
  // "raw" as a word), so each role block carries its own meaning.
  const { kanjiMeaning, radicalMeaning } = payload;

  // Which role blocks have something to show, and whether to LABEL them: a
  // single-role glyph drops the "As a …" label (see RoleBlock). Each block that
  // renders leads with its own "It means …". The radical block renders when it has
  // variant forms, or — when radical is the SOLE role (a pure radical like 禾) — to
  // carry the meaning nothing else would.
  const hasRadical = variants.length > 0 || (isRadical && !isKanji && !isWord);
  const hasKanji = isKanji;
  const hasWord = wordRows.length > 0;
  const labelled = [hasRadical, hasKanji, hasWord].filter(Boolean).length > 1;

  const usedIn = payload.usedIn;
  const shownUsedIn = usedIn.slice(0, CAP);
  const restUsedIn = usedIn.length - shownUsedIn.length;

  return (
    <EntrySurface>
      <ContentEntryHeader
        glyph={glyph}
        headline={payload.headline}
        typeLabel={item.typeLabel}
      />

        {/* ── AS A RADICAL: its meaning (only when nothing else carries it) and the
              shapes it takes inside other kanji. ── */}
        {hasRadical ? (
          <RoleBlock title="As a radical" labelled={labelled}>
            {radicalMeaning ? (
              <p className={`text-[14px] text-text-muted ${variants.length > 0 ? "mb-4" : ""}`}>
                It means <span className="text-text">{radicalMeaning}</span>.
              </p>
            ) : null}
            {variants.length > 0 ? (
              <>
                <SubLabel help="It takes a different shape depending on where in a kanji it appears:">
                  Variant forms
                </SubLabel>
                <table className="text-[15px]">
              <tbody>
                {variants.map((v) => (
                    <tr key={v.glyph}>
                      <td className="py-1.5 pr-6 align-middle font-kana text-[24px] leading-none text-text">
                        {v.glyph}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-8 align-middle text-[13px] text-text-muted">
                        {v.position}
                      </td>
                      <td className="whitespace-nowrap py-1.5 align-middle text-[12px] text-text-muted">
                        {v.example ? (
                          <>
                            as in{" "}
                            <Link
                              href={entryHref(v.example.entry)}
                              className="font-kana text-[16px] text-text no-underline"
                            >
                              {v.example.glyph}
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
                  <SubLabel>Sub-components</SubLabel>
                  <div className="flex flex-col gap-1.5">
                    {parts.map((p) => (
                      <Link
                        key={p.glyph}
                        href={entryHref(p.entry)}
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
                    As a rule of thumb, it&rsquo;s read one of these ways. Not a guarantee, but a
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
                                    <HearButton glyph={r.base} />
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
                            <HearButton glyph={w.reading} />
                            <span className="font-kana text-text">{w.reading}</span>
                          </span>
                        </td>
                        <td className="w-full py-1 align-top text-text-muted">
                          {w.meanings.map((m, i) => (
                            <span key={i} className={w.meanings.length > 1 ? "block" : undefined}>
                              <span>{m.text}</span>
                              {m.register.map((tag) => (
                                <span
                                  key={tag}
                                  className="mt-0.5 block text-[11px] leading-snug text-text-muted/80"
                                >
                                  {REGISTER_COPY[tag]}
                                </span>
                              ))}
                            </span>
                          ))}
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
                              href={entryHref(p.entry)}
                              className="flex items-baseline gap-2.5 text-text no-underline"
                            >
                              <span className="font-kana text-[20px] leading-none">{p.written}</span>
                              <span className="font-kana text-[14px] text-accent">{p.reading}</span>
                            </Link>
                          </td>
                          <td className="w-full py-1 align-middle text-[13px] text-text-muted">
                            {p.meaning}
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

        {/* Shape lookalikes, above "how it's written" — the reference before the
            "how to draw it". Only a character (single glyph) has them; a multi-char
            word is kind "word" with none. */}
        <ConfusionSection confusables={item.kind === "character" ? item.confusables : []} />

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
              precomputedFallback={payload.strokeFallback}
            />
          </div>
        ) : null}

        {usedIn.length > 0 ? (
          <Section title="Used as a part in">
            <div className="flex flex-col gap-1.5">
              {shownUsedIn.map((c) => (
                <Link
                  key={c.glyph}
                  href={entryHref(c.entry)}
                  className="flex items-baseline gap-2.5 text-[14px] text-text no-underline"
                >
                  <span className="font-kana text-[18px] leading-none">{c.glyph}</span>
                  <span className="min-w-0 flex-1 truncate text-text-muted">
                    {c.meaning}
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
