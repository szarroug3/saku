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
import {
  resolveConfusableRows,
  type ConfusableRowData,
} from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import { japaneseFontClass } from "@/lib/japanese-text";
import type { EntryId } from "@/types";

function ConfusableRow({ row }: { row: ConfusableRowData | undefined }) {
  if (!row) return null;
  return (
    <div className="flex flex-col gap-1">
      <Link
        href={row.href}
        className="flex items-baseline gap-2.5 text-[14px] text-text no-underline"
      >
        <span className={`${japaneseFontClass(row.glyph)} text-[18px] leading-none`}>{row.glyph}</span>
        {row.gloss ? <span className="min-w-0 flex-1 truncate text-text-muted">{row.gloss}</span> : null}
      </Link>
      {/* SAK-155: the hand-authored contrastive tip for a radical lookalike
          pair (口/囗, 日/曰) — dense rows elsewhere in this list stay a single
          truncated line, but a tip is the whole point of the row, so it wraps
          in full rather than clamping. */}
      {row.tip ? <p className="text-[12px] leading-relaxed text-text-muted">{row.tip}</p> : null}
    </div>
  );
}

function TileRow({
  ids,
  rows,
}: {
  ids: readonly EntryId[];
  rows: Record<string, ConfusableRowData>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {ids.map((id) => (
        <ConfusableRow key={id} row={rows[id as unknown as string]} />
      ))}
    </div>
  );
}

export function ConfusionSection({
  confusables,
  confused = [],
  glyph,
}: {
  confusables: readonly EntryId[];
  /** What history says you actually mixed this up with (a report). Optional —
   * the gallery has none. Anything here is removed from the shape line below. */
  confused?: readonly EntryId[];
  /** This page's OWN glyph (SAK-155) — passed through to resolveConfusableRows
   * so a hand-authored radical-pair tip (口/囗, 日/曰) attaches only to the row
   * that is actually this glyph's own pair partner, never to an unrelated row
   * that merely happens to share a target glyph (see that function's own doc).
   * Optional: a caller with no single "self" glyph just gets untipped rows,
   * the same rendering this component has always had. */
  glyph?: string;
}) {
  const confusedSet = new Set(confused);
  const lookalike = confusables.filter((id) => !confusedSet.has(id));
  // SAK-104: libEntry/entryHref both read server-only modules now, so every
  // tile's glyph/gloss/link is fetched in one batched call for the whole
  // (always small — shape lookalikes) set instead of a synchronous read per
  // row.
  const allIds = [...confused, ...lookalike];
  const rows = useServerLookup(resolveConfusableRows, [allIds, glyph]) ?? {};
  if (confused.length === 0 && lookalike.length === 0) return null;
  return (
    <>
      {confused.length > 0 ? (
        <Section title="You've mixed up with">
          <p className="mb-3 text-[13px] leading-relaxed text-text-muted">
            Ones you&rsquo;ve actually answered with by mistake:
          </p>
          <TileRow ids={confused} rows={rows} />
        </Section>
      ) : null}
      {lookalike.length > 0 ? (
        <Section title="Commonly mixed up with">
          <p className="mb-3 text-[13px] leading-relaxed text-text-muted">
            These look alike, so they&rsquo;re easy to confuse:
          </p>
          <TileRow ids={lookalike} rows={rows} />
        </Section>
      ) : null}
    </>
  );
}
