// RADICAL entry — the redesigned Library page for one radical, on the content
// model. Under the shared header: the radical's BUSHU name (what the shape is
// called when you describe a kanji's parts), the VARIANT forms it takes in
// different positions, how it's written, and the kanji built on it. A radical's
// whole reason for being is those kanji, so the list of them anchors the page.
// Reference data only (bushu names, variants, usedAsPartIn + kanji meanings);
// the reader's per-kanji standing is progress data a later pass layers in.

import Link from "next/link";

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { FlatSurfaceProvider, Info } from "@/components/ui";
import { GlassSheen, glassSurface } from "@/components/ui/frost";
import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { bushuName, radicalVariants } from "@/data/radicals";
import { usedAsPartIn } from "@/lib/library/components";
import { entryHref } from "@/lib/library/href";
import type { ContentItem } from "@/lib/content/item";

const CAP = 5;

// What "bushu" means, for the hover-help beside the section — it is a NAME for
// the shape, not a reading of the character, which the sound-button-free row
// reinforces.
const BUSHU_HELP =
  "The Japanese name for this radical shape, like のぎへん or にんべん. " +
  "You use it to describe how a kanji is built, not to read the character itself.";

// What "variant forms" are, for the hover-help beside that section.
const VARIANT_HELP =
  "The shape this radical changes into when it sits in a particular spot inside a " +
  "kanji — 水 becomes 氵 on the left. The label says where in the kanji it appears.";

// The five positions the data uses, in plain English (keyed by romaji, the
// stable field). A position we don't have a phrase for falls back to its kana.
const POSITION_EN: Record<string, string> = {
  hen: "left side",
  tsukuri: "right side",
  kanmuri: "top",
  ashi: "bottom",
  nyou: "wraps bottom-left",
};

export function RadicalEntryView({ item }: { item: ContentItem }) {
  const name = bushuName(item.glyph);
  const variants = radicalVariants(item.glyph);
  const kanji = usedAsPartIn(item.glyph);
  const shown = kanji.slice(0, CAP);
  const rest = kanji.length - shown.length;
  return (
    // Flat surface so the shared "How it's written" section sits inside the glass.
    <FlatSurfaceProvider>
      <article className={`${glassSurface} p-6`}>
        <GlassSheen />
        <ContentEntryHeader item={item} />

        {name ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="mb-2 flex items-center text-[11px] font-medium uppercase tracking-[0.06em] text-text">
              Bushu
              <Info>{BUSHU_HELP}</Info>
            </p>
            <p className="font-kana text-[15px] text-text">{name.kana}</p>
          </div>
        ) : null}

        {variants.length > 0 ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="mb-3 flex items-center text-[11px] font-medium uppercase tracking-[0.06em] text-text">
              Variant forms
              <Info>{VARIANT_HELP}</Info>
            </p>
            {/* Each positional form the radical takes in a compound — the glyph,
                what it's called, and where it sits (へん = left side, …). */}
            <div className="flex flex-col gap-2.5">
              {variants.map((v) => (
                <div key={v.glyph} className="flex items-baseline gap-2.5 text-[15px]">
                  <span className="w-6 flex-none font-kana text-[22px] leading-none text-text">
                    {v.glyph}
                  </span>
                  <span className="font-kana text-text">{v.name.kana}</span>
                  {v.position ? (
                    <span className="text-[12px] text-text-muted">
                      · {POSITION_EN[v.position.romaji] ?? v.position.kana}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 border-t border-border/50 pt-5">
          <HowItsWritten
            item={{ entry: item.entry, glyph: item.glyph, kind: "radical", facts: item.facts.map((f) => f.id) }}
            alwaysOpen
          />
        </div>

        {kanji.length > 0 ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-text">
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
