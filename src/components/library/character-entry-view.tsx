"use client";

// CHARACTER entry — the redesigned Library page for one Han glyph, COMPOSED BY
// ROLE. A single glyph is ONE item that plays some set of roles (radical · kanji
// · word), and this page stacks exactly the sections those roles call for:
//
// ORGANISED BY ROLE. The per-role sections carry an ACCENT eyebrow (matching the
// header's "radical · kanji · word" tags); the universal ones stay white:
//
//   header
//   As a radical  (accent) — the shapes it takes inside other kanji, and where
//   As a kanji    (accent) — on'yomi / kun'yomi, then etymology (components + origin)
//   As a word     (accent) — how the standalone word is pronounced + what it means
//   How it's written (white) — always
//   Used as a part in (white) — when other kanji are built on it
//
// EVERY section is guarded on ITS OWN content, so a glyph shows only the roles it
// actually plays: a pure radical (禾) shows no "As a kanji"/"As a word"; 水
// (radical · kanji · word) shows all three. No per-role forks — one page,
// sections switched on by content.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { FlatSurfaceProvider, Info, SoundIcon } from "@/components/ui";
import { GlassSheen, glassSurface } from "@/components/ui/frost";
import { speak } from "@/lib/speech";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { etymologyOf } from "@/data/kanji-etymology";
import { radicalVariants } from "@/data/radicals";
import { vocabRow } from "@/data/vocab";
import { builtPieceEntryId, readingsOf } from "@/lib/library/entries";
import { teachableParts } from "@/lib/kanji-parts";
import { usedAsPartIn } from "@/lib/library/components";
import { entryHref } from "@/lib/library/href";
import type { ContentItem } from "@/lib/content/item";

const CAP = 5;

const VARIANT_HELP =
  "The shape this radical changes into when it sits in a particular spot inside a " +
  "kanji — 水 becomes 氵 on the left. The label says where in the kanji it appears.";

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

/** The word senses of a single-char word: one row per reading, its glosses
 * merged. Sourced from vocab (not the teach-unit meanings, which fold the kanji's
 * core sense onto the primary reading), so 生 reads なま → "raw", not "life/raw".
 * Empty when the glyph is not a standalone word. */
function wordSensesOf(glyph: string): { reading: string; meaning: string }[] {
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

/** A titled section under a top divider — the one shape every block below the
 * header shares. `tone="accent"` colours the eyebrow like the header's role tags,
 * used for the per-role sections (As a radical / kanji / word); the universal
 * sections (How it's written, Used as a part in) keep the default white. */
function Section({
  title,
  help,
  tone = "default",
  children,
}: {
  title: string;
  help?: string;
  tone?: "default" | "accent";
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-border/50 pt-5">
      <p
        className={`mb-3 flex items-center text-[11px] font-medium uppercase tracking-[0.06em] ${
          tone === "accent" ? "text-accent" : "text-text"
        }`}
      >
        {title}
        {help ? <Info>{help}</Info> : null}
      </p>
      {children}
    </div>
  );
}

/** A muted sub-label inside a role section (On'yomi, Etymology, …). */
function SubLabel({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <p className="mb-2 flex items-center text-[12px] font-medium text-text-muted">
      {children}
      {help ? <Info>{help}</Info> : null}
    </p>
  );
}

/** A muted one-line description that opens a role section, framing what follows
 * (teaching, not app-narration — it says something true about Japanese). */
function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[12.5px] leading-relaxed text-text-muted">{children}</p>;
}

export function CharacterEntryView({ item }: { item: ContentItem }) {
  const glyph = item.glyph;
  const isKanji = item.roles.includes("kanji");
  const isRadical = item.roles.includes("radical");

  const parts = isKanji ? builtFrom(glyph) : [];
  const story = isKanji ? (etymologyOf(glyph)?.originText ?? null) : null;
  const isWord = item.roles.includes("word");
  const groups = isKanji ? readingGroups(glyph) : [];
  const variants = isRadical ? radicalVariants(glyph) : [];
  const wordRows = isWord ? wordSensesOf(glyph) : [];

  const usedIn = usedAsPartIn(glyph);
  const shownUsedIn = usedIn.slice(0, CAP);
  const restUsedIn = usedIn.length - shownUsedIn.length;

  return (
    <FlatSurfaceProvider>
      <article className={`${glassSurface} p-6`}>
        <GlassSheen />
        <ContentEntryHeader item={item} />

        {/* ── AS A RADICAL: the shapes it takes inside other kanji, and where. ── */}
        {variants.length > 0 ? (
          <Section title="As a radical" tone="accent">
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
          </Section>
        ) : null}

        {/* ── AS A KANJI: on'yomi / kun'yomi, then the etymology (its components
              and where the shape came from). ── */}
        {groups.length > 0 || parts.length > 0 || story ? (
          <Section title="As a kanji" tone="accent">
            <div className="flex flex-col gap-6">
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
          </Section>
        ) : null}

        {/* ── AS A WORD: how the standalone word is pronounced and what it means.
              One row per reading, glosses merged; a diverging sense shows here
              (生 なま = raw, not the kanji's "life"). ── */}
        {wordRows.length > 0 ? (
          <Section title="As a word" tone="accent">
            <Lead>
              {wordRows.length > 1
                ? "It's read more than one way as a word, and the meaning depends on the pronunciation:"
                : "On its own, this glyph is a word:"}
            </Lead>
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
                    <td className="w-full py-1 align-top text-text-muted">{w.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        ) : null}

        {/* HowItsWritten renders its own white eyebrow heading, so it sits under a
            plain divider rather than inside a titled Section. */}
        <div className="mt-5 border-t border-border/50 pt-5">
          <HowItsWritten
            item={{
              entry: item.entry,
              glyph,
              kind: isKanji ? "kanji" : "radical",
              facts: item.facts.map((f) => f.id),
            }}
            alwaysOpen
          />
        </div>

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
      </article>
    </FlatSurfaceProvider>
  );
}
