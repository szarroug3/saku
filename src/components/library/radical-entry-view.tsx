// RADICAL entry — the redesigned Library page for one radical, on the content
// model. A radical's whole reason for being is the kanji built on it, so under
// the shared header the page lists those kanji and what each means. Reference
// data only (usedAsPartIn + kanji meanings); the reader's per-kanji standing is
// progress data a later pass layers in, not part of the item.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { FlatSurfaceProvider } from "@/components/ui";
import { GlassSheen, glassSurface } from "@/components/ui/frost";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { usedAsPartIn } from "@/lib/library/components";
import { entryHref } from "@/lib/library/href";
import type { ContentItem } from "@/lib/content/item";

const CAP = 24;

export function RadicalEntryView({ item }: { item: ContentItem }) {
  const kanji = usedAsPartIn(item.glyph);
  const shown = kanji.slice(0, CAP);
  const rest = kanji.length - shown.length;
  return (
    // Flat surface so the shared "How it's written" section sits inside the glass.
    <FlatSurfaceProvider>
      <article className={`${glassSurface} p-6`}>
        <GlassSheen />
        <ContentEntryHeader item={item} />

        <div className="mt-5 border-t border-border/50 pt-5">
          <HowItsWritten
            item={{ entry: item.entry, glyph: item.glyph, kind: "radical", facts: item.facts.map((f) => f.id) }}
            alwaysOpen
          />
        </div>

        {kanji.length > 0 ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">
              Used as a part in
            </p>
            <div className="flex flex-col gap-1.5">
              {shown.map((c) => (
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
            {rest > 0 ? <p className="mt-2.5 text-[12px] text-text-muted">· {rest} more</p> : null}
            <p className="mt-3 text-[12px] text-text-muted">
              {kanji.length === 1
                ? "1 kanji is written with this shape."
                : `${kanji.length} kanji are written with this shape.`}
            </p>
          </div>
        ) : null}
      </article>
    </FlatSurfaceProvider>
  );
}
