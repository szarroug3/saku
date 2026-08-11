// KANJI entry — the redesigned Library page for one kanji (a "character" item),
// on the content model. Under the shared header: how it's written, what it's
// BUILT FROM (its components, each a link, with the origin story that explains
// them), and what it is in turn a part OF. Reference data only.
//
// Readings are NOT here yet: the model attributes a kanji's readings to the WORDS
// that attest them (see build-item.ts), so a reading row is reconstructed from
// vocabulary — a follow-up once that reconstruction is metric-free.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { FlatSurfaceProvider } from "@/components/ui";
import { GlassSheen, glassSurface } from "@/components/ui/frost";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { etymologyOf } from "@/data/kanji-etymology";
import { builtPieceEntryId } from "@/lib/library/entries";
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

export function KanjiEntryView({ item }: { item: ContentItem }) {
  const story = etymologyOf(item.glyph)?.originText ?? null;
  const parts = builtFrom(item.glyph);
  const usedIn = usedAsPartIn(item.glyph);
  const shownUsedIn = usedIn.slice(0, CAP);
  const restUsedIn = usedIn.length - shownUsedIn.length;

  return (
    <FlatSurfaceProvider>
      <article className={`${glassSurface} p-6`}>
        <GlassSheen />
        <ContentEntryHeader item={item} />

        <div className="mt-5 border-t border-border/50 pt-5">
          <HowItsWritten
            item={{ entry: item.entry, glyph: item.glyph, kind: "kanji", facts: item.facts.map((f) => f.id) }}
            alwaysOpen
          />
        </div>

        {parts.length > 0 ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">
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

        {usedIn.length > 0 ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">
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
