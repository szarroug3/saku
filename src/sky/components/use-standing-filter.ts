"use client";

// The legend as a filter, for any page that puts a StandingLegend beside a
// SkyField: a standing is drawn only while its word is selected, and
// hovering a selected word singles its stars out among the rest. The home
// starts with everything but "undiscovered" selected; a lesson or an Atlas
// shelf can start elsewhere. Nothing selected shows nothing.

import { useCallback, useState } from "react";

import type { StarLook } from "@/sky/components/constellation";
import { STANDING_ORDER, type Standing } from "@/sky/lib/standing";

export interface StandingFilter {
  selected: ReadonlySet<Standing>;
  toggle: (s: Standing) => void;
  singled: Standing | null;
  setSingled: (s: Standing | null) => void;
  /** For SkyField: hides unselected standings, mutes all but the singled one. */
  lookOf: (id: string, base: StarLook) => StarLook;
}

export const ALL_BUT_UNDISCOVERED: readonly Standing[] = STANDING_ORDER.filter((s) => s !== "not-seen");

export function useStandingFilter(initial: readonly Standing[] = ALL_BUT_UNDISCOVERED): StandingFilter {
  const [selected, setSelected] = useState<ReadonlySet<Standing>>(() => new Set(initial));
  const [singled, setSingled] = useState<Standing | null>(null);
  const toggle = useCallback((s: Standing) => setSelected((prev) => { const next = new Set(prev); if (next.has(s)) next.delete(s); else next.add(s); return next; }), []);
  const lookOf = useCallback((_id: string, base: StarLook): StarLook => {
    if (!selected.has(base.standing)) return { ...base, hidden: true };
    if (singled && base.standing !== singled) return { ...base, muted: true };
    return base;
  }, [selected, singled]);
  return { selected, toggle, singled, setSingled, lookOf };
}
