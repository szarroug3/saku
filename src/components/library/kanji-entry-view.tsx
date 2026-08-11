"use client";

// KANJI entry — the redesigned Library page for one kanji (a "character" item),
// on the content model. Under the shared header: the readings (on'yomi / kun'yomi
// side by side), what it is BUILT FROM (its components, each a link, with the
// origin story that explains them), how it's written, and what it is in turn a
// part OF. Reference data only.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { FlatSurfaceProvider, Info, SoundIcon } from "@/components/ui";
import { GlassSheen, glassSurface } from "@/components/ui/frost";
import { speak } from "@/lib/speech";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { etymologyOf } from "@/data/kanji-etymology";
import { builtPieceEntryId, readingsOf } from "@/lib/library/entries";
import { teachableParts } from "@/lib/kanji-parts";
import { usedAsPartIn } from "@/lib/library/components";
import { entryHref } from "@/lib/library/href";
import type { ContentItem } from "@/lib/content/item";

const CAP = 24;

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

export function KanjiEntryView({ item }: { item: ContentItem }) {
  const story = etymologyOf(item.glyph)?.originText ?? null;
  const parts = builtFrom(item.glyph);
  const groups = readingGroups(item.glyph);
  const usedIn = usedAsPartIn(item.glyph);
  const shownUsedIn = usedIn.slice(0, CAP);
  const restUsedIn = usedIn.length - shownUsedIn.length;

  return (
    <FlatSurfaceProvider>
      <article className={`${glassSurface} p-6`}>
        <GlassSheen />
        <ContentEntryHeader item={item} />

        {parts.length > 0 ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-text">
              Built from
            </p>
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
          </div>
        ) : null}

        {groups.length > 0 ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-text">
              Readings
            </p>
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
          </div>
        ) : null}

        <div className="mt-5 border-t border-border/50 pt-5">
          <HowItsWritten
            item={{ entry: item.entry, glyph: item.glyph, kind: "kanji", facts: item.facts.map((f) => f.id) }}
            alwaysOpen
          />
        </div>

        {usedIn.length > 0 ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-text">
              Used as a part in
            </p>
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
          </div>
        ) : null}
      </article>
    </FlatSurfaceProvider>
  );
}
