"use client";

// The strip above every session screen: what you're running, where you are in
// it, and the one way out. Deliberately the same furniture on all three
// screens (fork, rest, complete) so the loop reads as one place you stay in
// rather than three pages you're bounced between.

import type { ReactNode } from "react";

import { SmallBtn } from "@/components/ui";

export function SessionHud({
  label,
  where,
  pct,
  tone = "accent",
  onDone,
  children,
}: {
  /** What's running — "Review · 20". */
  label: string;
  /** Where you are — "round 1 · done", "resting", "complete". */
  where: string;
  /** Bar fill, 0–100. */
  pct: number;
  /** The bar's colour. The rest's bar is deliberately grey: it is elapsing,
   * not progressing, and painting it accent would make waiting look like
   * achieving. */
  tone?: "accent" | "muted" | "success";
  /** Omitted on the complete screen, which has nothing left to leave. */
  onDone?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="px-3 py-1.5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <span className="kq-material rounded-full border border-border px-2.5 py-0.5">
          {label}
        </span>
        <span className="tabular-nums">{where}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {children}
          {onDone ? <SmallBtn onClick={onDone}>Done for now</SmallBtn> : null}
        </span>
      </div>
      <div className="h-(--bar-h) overflow-hidden rounded-full bg-panel">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            tone === "muted"
              ? "bg-text-muted"
              : tone === "success"
                ? "bg-success"
                : "bg-accent"
          }`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
