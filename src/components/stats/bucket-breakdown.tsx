"use client";

// The side panel behind a clickable standing count (SAK-78). "83 solid" opens
// this and lists exactly the facts that number is a sum of — never a second
// query that could disagree with the count that opened it.
//
// FACTS, NOT ENTRIES. This panel's population is `factsByStanding`'s own
// output — tally.ts's own accumulator, kept instead of counted — so it is
// literally the same walk that produced the number on the card, not a
// re-derived list. It stays a list of facts for the same reason the card
// above it does: an entry has no standing of its own (see tally.ts's header),
// so grouping these rows back up by entry would put 生 in "one" bucket that no
// fact of 生 is actually in.
//
// NOT A MIX-UP BREAKDOWN. SAK-22 already settled that a fact's standing and a
// mix-up pair are two different questions with no shared denominator (see
// mix-ups.tsx's MIX_UP_INFO) — this panel stays inside the standing question
// it was opened from and does not try to explain WHY a fact is shaky, only
// which facts currently are.
//
// RADIX DIALOG, NOT A NEW OVERLAY PRIMITIVE. ui/confirm-dialog.tsx already
// pulls `radix-ui` in for AlertDialog and library/filter-dropdown.tsx for
// Popover — both for the same reason: the focus trap, Escape-to-close, the
// aria wiring, and a portal to <body> so the surface has the real page behind
// it (see confirm-dialog.tsx's PORTALLED comment) are tedious to get right by
// hand and already solved once. Dialog is the same family, used here instead
// of AlertDialog because this panel isn't asking a yes/no question — it's
// showing a list.
//
// EACH ROW OPENS THE FACT'S LIBRARY PAGE (SAK-78 review). A row already knows
// its FactId; `entryOf` is facts.ts's own FactId → EntryId step (a fact has no
// page of its own — see facts.ts) and `entryHref` is library/href.ts's one
// minter for an entry's URL. No new URL scheme: this is the same two calls
// entry-tile.tsx makes to link a tile, just chained from a fact instead of an
// entry the caller already had.
//
// NO BACKDROP-FILTER ON THE SLIDING SURFACE (SAK-78 review, perf). This panel
// used to wear `kq-material kq-overlay`, the same pattern confirm-dialog.tsx
// and filter-dropdown.tsx use for a portalled panel that needs kiri's frost.
// Those panels fade or pop in place; this one SLIDES the full height of the
// screen every open/close. A `backdrop-filter` blur is not a paint-once
// effect — Chromium re-snapshots and re-blurs whatever is behind the element
// on every animation frame, at every position along the slide (see globals.
// css's "THE FROST IS NOT HERE ANY MORE" and CARD MATERIAL sections: the
// Library grid's own cards dropped exactly this filter for the same reason,
// p95 33.4ms → 17.6ms). That is Sam's diagnosis and it is correct: kiri's
// --card here is deliberately translucent (see globals.css's STICKY TABLE
// HEADER note), so the panel relied on kq-overlay's live blur just to be
// legible, which is the most expensive way to stay opaque while moving.
// `kq-surface` is the codebase's existing answer to "I need a card's material
// without a live backdrop-filter" (globals.css's CARD MATERIAL section) —
// add-to-list.tsx's popover uses it for the identical reason (two backdrop
// roots stacked, inner blur a no-op). It rebuilds the surface OPAQUELY from
// --bg + the mesh + --card's own fill, saturated once via a filter that never
// samples the live page, so sliding this panel costs a transform, not a blur.
//
// THE SHELL LIVES IN side-panel.tsx. When by-subject.tsx's rows needed the
// same clickable-sidebar treatment (SAK-78 follow-up review), the Dialog
// wiring, the kq-surface slide and the header/close-button chrome above were
// pulled out into `SidePanel` rather than copied a second time — this file
// keeps only what's actually about a STANDING: the tone dot and the
// fact-shaped row. See entry-breakdown.tsx for the entry-shaped sibling.

import * as React from "react";
import Link from "next/link";

import { entryOf, factInfo } from "@/lib/facts";
import { fillFor } from "@/components/stats/tally";
import { entryHref } from "@/lib/library/href";
import { SidePanel } from "@/components/stats/side-panel";
import type { Standing } from "@/lib/library/standing";
import type { FactId } from "@/types";

export function BucketBreakdown({
  standing,
  label,
  facts,
  onClose,
}: {
  /** Which bucket is open, or null when the panel is closed. Also the tone
   * dot next to the title — the one thing on the card the panel doesn't
   * repeat is the colour, so it carries it here instead. */
  standing: Standing | null;
  /** The bucket's own word, pluralised — "83 solid", not "solid". Passed in
   * rather than looked up here so the panel never has to duplicate
   * BUCKET_LABEL's pluralisation seam (see tally.ts). */
  label: string;
  facts: readonly FactId[];
  onClose: () => void;
}) {
  return (
    <SidePanel
      open={standing !== null}
      label={label}
      onClose={onClose}
      testId="bucket-breakdown"
      icon={
        standing ? (
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 flex-none rounded-full ${fillFor(standing)}`}
          />
        ) : null
      }
    >
      {facts.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2.5 text-[13px]">
          {facts.map((f) => {
            const info = factInfo(f);
            // A fact id history kept but the data no longer has: render
            // the bare id rather than throw. The card above it already
            // extends the same courtesy (see facts.ts's factInfo doc).
            if (!info) {
              return (
                <li key={f} className="text-text-muted">
                  {f}
                </li>
              );
            }
            return (
              <li key={f}>
                <Link
                  href={entryHref(entryOf(f))}
                  onClick={onClose}
                  className="flex items-baseline justify-between gap-3 hover:underline"
                >
                  <span className="font-kana">{info.glyph}</span>
                  {info.meaning ? (
                    <span className="truncate text-right text-text-muted">
                      {info.meaning}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SidePanel>
  );
}
