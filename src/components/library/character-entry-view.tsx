"use client";

// CHARACTER entry — the redesigned Library page for one Han glyph, COMPOSED BY
// ROLE. A single glyph is ONE item that plays some set of roles (radical · kanji
// · word), and this page stacks exactly the sections those roles call for:
//
//   header
//   Built from      (kanji: its components + origin story)
//   Variant forms   (radical: the shapes it takes in other kanji, + where)
//   Readings        (kanji: on'yomi / kun'yomi side by side)
//   How it's written (always)
//   Used as a part in (always, when other kanji are built on it)
//
// Recognition-first: the forms a radical takes in other kanji lead, above the
// readings. A pure radical (禾) renders only variant forms + how-it's-written +
// used-in and stays lean; 水 (radical · kanji · word) shows its variants AND its
// readings — one page, no per-role forks. Reference data only.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { FlatSurfaceProvider, Info, SoundIcon } from "@/components/ui";
import { GlassSheen, glassSurface } from "@/components/ui/frost";
import { speak } from "@/lib/speech";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { etymologyOf } from "@/data/kanji-etymology";
import { radicalVariants } from "@/data/radicals";
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
 * header shares. */
function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-border/50 pt-5">
      <p className="mb-3 flex items-center text-[11px] font-medium uppercase tracking-[0.06em] text-text">
        {title}
        {help ? <Info>{help}</Info> : null}
      </p>
      {children}
    </div>
  );
}

export function CharacterEntryView({ item }: { item: ContentItem }) {
  const glyph = item.glyph;
  const isKanji = item.roles.includes("kanji");
  const isRadical = item.roles.includes("radical");

  const parts = isKanji ? builtFrom(glyph) : [];
  const story = isKanji ? (etymologyOf(glyph)?.originText ?? null) : null;
  const groups = isKanji ? readingGroups(glyph) : [];
  const variants = isRadical ? radicalVariants(glyph) : [];

  const usedIn = usedAsPartIn(glyph);
  const shownUsedIn = usedIn.slice(0, CAP);
  const restUsedIn = usedIn.length - shownUsedIn.length;

  return (
    <FlatSurfaceProvider>
      <article className={`${glassSurface} p-6`}>
        <GlassSheen />
        <ContentEntryHeader item={item} />

        {parts.length > 0 ? (
          <Section title="Built from">
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
            {story ? <p className="mt-3 text-[13px] leading-relaxed text-text-muted">{story}</p> : null}
          </Section>
        ) : null}

        {variants.length > 0 ? (
          <Section title="Variant forms" help={VARIANT_HELP}>
            {/* The shapes this radical takes inside other kanji, and where each
                sits — the recognition cue, so it leads. Ordered normal → top →
                left → right → bottom. The bushu name is dropped: it's untranslated
                jargon, and the shape + position are what a reader acts on. */}
            <table className="text-[15px]">
              <tbody>
                {variants
                  .map((v) => ({ v, pos: positionOf(v) }))
                  .sort((a, b) => a.pos.rank - b.pos.rank)
                  .map(({ v, pos }) => (
                    <tr key={v.glyph}>
                      <td className="py-1.5 pr-6 align-middle font-kana text-[24px] leading-none text-text">
                        {v.glyph}
                      </td>
                      <td className="whitespace-nowrap py-1.5 align-middle text-[13px] text-text-muted">
                        {pos.en}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Section>
        ) : null}

        {groups.length > 0 ? (
          <Section title="Readings">
            {/* On'yomi and kun'yomi side by side (one column when a kanji has only
                one type). Each row: sound + reading, then an example word. */}
            <div className={`grid gap-x-10 gap-y-6 ${groups.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {groups.map((g) => (
                <div key={g.label}>
                  <p className="mb-2 flex items-center text-[12px] font-medium text-text-muted">
                    {g.label}
                    <Info>{g.help}</Info>
                  </p>
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
                          <td className="w-full py-1 align-middle font-kana text-text-muted">{r.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
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
