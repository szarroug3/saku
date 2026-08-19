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
// aria wiring, and a portal to <body> so kq-material's backdrop-filter has the
// real page behind it (see confirm-dialog.tsx's PORTALLED comment) are tedious
// to get right by hand and already solved once. Dialog is the same family,
// used here instead of AlertDialog because this panel isn't asking a
// yes/no question — it's showing a list.

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { factInfo } from "@/lib/facts";
import { fillFor } from "@/components/stats/tally";
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
    <DialogPrimitive.Root
      open={standing !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid="bucket-breakdown-overlay"
          className="fixed inset-0 z-50 bg-(--scrim) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          data-testid="bucket-breakdown"
          aria-describedby={undefined}
          className={[
            "fixed inset-y-0 right-0 z-50 flex w-[calc(100vw-24px)] max-w-[380px] flex-col",
            "border-l border-border bg-card shadow-card",
            // kq-overlay for the same reason confirm-dialog.tsx and
            // filter-dropdown.tsx add it to a portalled panel: kq-material
            // alone no longer carries kiri's frost (the scrolling shelf cards
            // gave up their own backdrop-filter for scroll perf), so a lone
            // panel would let the page read straight through it.
            "kq-material kq-overlay",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <span className="flex items-center gap-2 min-w-0">
              {standing ? (
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 flex-none rounded-full ${fillFor(standing)}`}
                />
              ) : null}
              <DialogPrimitive.Title className="truncate text-[15px] font-semibold text-text">
                {label}
              </DialogPrimitive.Title>
            </span>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                data-testid="bucket-breakdown-close"
                aria-label="Close"
                className="flex-none cursor-pointer rounded-md px-2 py-1 text-text-muted hover:text-text"
              >
                Close
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
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
                    <li key={f} className="flex items-baseline justify-between gap-3">
                      <span className="font-kana">{info.glyph}</span>
                      {info.meaning ? (
                        <span className="truncate text-right text-text-muted">
                          {info.meaning}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
