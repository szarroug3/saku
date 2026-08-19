"use client";

// The chrome a Progress-page side panel is built from — the sliding surface,
// the header row (a title, an optional tone dot, a Close button), and the
// scrollable body — extracted once two panels needed the exact same shell
// (SAK-78): BucketBreakdown (a standing's facts) and EntryBreakdown (a
// subject's met entries). What differs between them is the ROW, not the
// shell — a fact row and an entry row resolve their glyph/meaning through
// different lookups (factInfo vs. glyphOf+factsOf) and one carries a
// standing's tone dot the other has no equivalent of — so only the shell
// moved here. See bucket-breakdown.tsx and entry-breakdown.tsx for what each
// keeps to itself.
//
// RADIX DIALOG, NOT A NEW OVERLAY PRIMITIVE, and NO BACKDROP-FILTER ON THE
// SLIDING SURFACE. Both calls are explained at length in bucket-breakdown.tsx
// (this is the same panel that comment was written about, just with its
// row-rendering pulled out) — read that file's header before changing
// anything about the Dialog wiring or the `kq-surface` class below; the
// reasoning was hard-won (a live p95 perf regression) and still applies to
// every panel built from this shell, not just the first one.

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

export function SidePanel({
  open,
  label,
  icon,
  onClose,
  testId,
  children,
}: {
  open: boolean;
  /** The panel's title — already formatted by the caller ("83 solid",
   * "70 met"), same as BucketBreakdown always required. */
  label: string;
  /** A tone dot or similar mark next to the title. BucketBreakdown passes a
   * standing's colour; EntryBreakdown has no equivalent concept and passes
   * nothing. */
  icon?: React.ReactNode;
  onClose: () => void;
  /** Prefixes the shell's own `data-testid`s ("bucket-breakdown",
   * "entry-breakdown") so a test can tell which panel is open without a
   * second selector scheme per panel. */
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid={`${testId}-overlay`}
          className="fixed inset-0 z-50 bg-(--scrim) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          data-testid={testId}
          aria-describedby={undefined}
          className={[
            "fixed inset-y-0 right-0 z-50 flex w-[calc(100vw-24px)] max-w-[380px] flex-col",
            "border-l border-border shadow-card",
            // kq-surface, not kq-material kq-overlay: this panel SLIDES, so it
            // cannot afford a live backdrop-filter — see bucket-breakdown.tsx's
            // header comment (NO BACKDROP-FILTER ON THE SLIDING SURFACE).
            "kq-surface",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <span className="flex items-center gap-2 min-w-0">
              {icon}
              <DialogPrimitive.Title className="truncate text-[15px] font-semibold text-text">
                {label}
              </DialogPrimitive.Title>
            </span>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                data-testid={`${testId}-close`}
                aria-label="Close"
                className="flex-none cursor-pointer rounded-md px-2 py-1 text-text-muted hover:text-text"
              >
                Close
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
