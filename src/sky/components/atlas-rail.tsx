"use client";

// The Atlas's rail: the collections with their whole counts, and the
// learner's status over the open collection, one of each picked at a time.
// It hides whole on its own button (Sam's call, 2026-09-05), leaving the
// page's opener to bring it back. No kind dots on the collections: Sam
// found the colours confusing.

import type { ReactNode } from "react";

import { RoundButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkySurface } from "@/sky/components/sky-panel";
import { STANDING, STANDING_ORDER, standingWord, type Standing } from "@/sky/lib/standing";

export interface RailCollection { id: string; title: string; total: number }

export interface AtlasRailProps {
  collections: readonly RailCollection[];
  open: string;
  onOpen: (id: string) => void;
  /** The open collection's counts by standing, "undiscovered" included. */
  counts?: Readonly<Record<Standing, number>>;
  total?: number;
  status: Standing | null;
  onStatus: (s: Standing | null) => void;
  onHide: () => void;
}


/** A rail row: a name with a count on the right, and a dot before it when
 * the row stands for a standing. */
function RailRow({ on, dot, label, count, onClick }: { on: boolean; dot?: ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] ${on ? "bg-sky-card-strong font-semibold text-sky-ink" : "text-sky-muted hover:bg-sky-card hover:text-sky-ink"}`}>
      {dot}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-[11px] tabular-nums text-sky-faint">{count.toLocaleString()}</span>}
    </button>
  );
}

const dot = (cls: string) => <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;

export function AtlasRail({ collections, open, onOpen, counts, total, status, onStatus, onHide }: AtlasRailProps) {
  return (
    <SkySurface as="nav" pad="sm" aria-label="Collections and status" className="flex min-h-0 flex-col gap-5 self-stretch overflow-y-auto">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Eyebrow tight>Collections</Eyebrow>
          <RoundButton label="Hide the rail" expanded onClick={onHide}>‹</RoundButton>
        </div>
        {collections.map((c) => <RailRow key={c.id} on={c.id === open} label={c.title} count={c.total} onClick={() => onOpen(c.id)} />)}
      </div>
      {counts && (
        <div>
          <Eyebrow className="mb-1.5">Your status</Eyebrow>
          <RailRow on={status === null} dot={dot("border border-sky-line")} label="Everything" count={total} onClick={() => onStatus(null)} />
          {STANDING_ORDER.map((s) => (
            <RailRow key={s} on={status === s} dot={dot(STANDING[s].dot)} label={standingWord(s)} count={counts[s]} onClick={() => onStatus(status === s ? null : s)} />
          ))}
        </div>
      )}
    </SkySurface>
  );
}
