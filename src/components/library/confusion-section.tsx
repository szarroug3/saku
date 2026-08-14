"use client";

// "Commonly mixed up with" — the shape lookalikes a character or kana is easy to
// confuse (シ/ツ, 木/本). It reads the item's own `confusables` field (a build-time
// property of the glyph's SHAPE, see ContentItem), never recomputing it here — a
// prediction from geometry, said as a prediction.
//
// The `confused` list, when a caller has history, is the OTHER question: what you
// have ACTUALLY answered with by mistake. It is a report, not a guess, so it gets
// its own labelled block above and the shape line drops anything it already names.
// The library route passes it; the reference gallery has no history and omits it.

import Link from "next/link";

import { Section } from "@/components/library/entry-section";
import { libEntry } from "@/lib/library/library-index";
import { entryHref } from "@/lib/library/href";
import { japaneseFontClass } from "@/lib/japanese-text";
import type { EntryId } from "@/types";

function ConfusableRow({ id }: { id: EntryId }) {
  const le = libEntry(id);
  if (!le) return null;
  const gloss = le.meanings[0] ?? le.readings[0] ?? "";
  return (
    <Link
      href={entryHref(id)}
      className="flex items-baseline gap-2.5 text-[14px] text-text no-underline"
    >
      <span className={`${japaneseFontClass(le.glyph)} text-[18px] leading-none`}>{le.glyph}</span>
      {gloss ? <span className="min-w-0 flex-1 truncate text-text-muted">{gloss}</span> : null}
    </Link>
  );
}

function TileRow({ ids }: { ids: readonly EntryId[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {ids.map((id) => (
        <ConfusableRow key={id} id={id} />
      ))}
    </div>
  );
}

export function ConfusionSection({
  confusables,
  confused = [],
}: {
  confusables: readonly EntryId[];
  /** What history says you actually mixed this up with (a report). Optional —
   * the gallery has none. Anything here is removed from the shape line below. */
  confused?: readonly EntryId[];
}) {
  const confusedSet = new Set(confused);
  const lookalike = confusables.filter((id) => !confusedSet.has(id));
  if (confused.length === 0 && lookalike.length === 0) return null;
  return (
    <>
      {confused.length > 0 ? (
        <Section title="You've mixed up with">
          <p className="mb-3 text-[13px] leading-relaxed text-text-muted">
            Ones you&rsquo;ve actually answered with by mistake:
          </p>
          <TileRow ids={confused} />
        </Section>
      ) : null}
      {lookalike.length > 0 ? (
        <Section title="Commonly mixed up with">
          <p className="mb-3 text-[13px] leading-relaxed text-text-muted">
            These look alike, so they&rsquo;re easy to confuse:
          </p>
          <TileRow ids={lookalike} />
        </Section>
      ) : null}
    </>
  );
}
