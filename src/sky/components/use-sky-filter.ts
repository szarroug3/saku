"use client";

// The sky's filters, for any page that puts a legend beside a SkyField: the
// standings to paint, and the collections to draw at all. The home starts
// with every collection and everything but "undiscovered", and hovering a
// standing singles its stars out among the rest.
//
// The two cut differently on purpose. A STANDING is a property of one star,
// so an unselected standing hides that star inside its constellation; the
// constellation stays, as long as something in it still shows. A COLLECTION
// is a property of the whole constellation, so an unselected one takes it
// out. Either way a constellation with nothing left to draw is not laid out
// at all, so the sky always packs around what is shown (see sky-field.tsx).

import { useCallback, useState } from "react";

import type { StarLook } from "@/sky/components/constellation";
import { ALL_GROUPS, type SkyGroup } from "@/sky/lib/groups";
import { STANDING_ORDER, type Standing } from "@/sky/lib/standing";

export interface SkyFilter {
  selected: ReadonlySet<Standing>;
  toggle: (s: Standing) => void;
  singled: Standing | null;
  setSingled: (s: Standing | null) => void;
  /** The collections drawn. One left out is not in the sky at all. */
  groups: ReadonlySet<SkyGroup>;
  toggleGroup: (g: SkyGroup) => void;
  /** For SkyField: hides unselected standings, mutes all but the singled one. */
  lookOf: (id: string, base: StarLook) => StarLook;
}

export const ALL_BUT_UNDISCOVERED: readonly Standing[] = STANDING_ORDER.filter((s) => s !== "not-seen");

export function useSkyFilter(initial: readonly Standing[] = ALL_BUT_UNDISCOVERED): SkyFilter {
  const [selected, setSelected] = useState<ReadonlySet<Standing>>(() => new Set(initial));
  const [groups, setGroups] = useState<ReadonlySet<SkyGroup>>(() => new Set(ALL_GROUPS));
  const [singled, setSingled] = useState<Standing | null>(null);
  const toggle = useCallback((s: Standing) => setSelected((prev) => { const next = new Set(prev); if (next.has(s)) next.delete(s); else next.add(s); return next; }), []);
  const toggleGroup = useCallback((g: SkyGroup) => setGroups((prev) => { const next = new Set(prev); if (next.has(g)) next.delete(g); else next.add(g); return next; }), []);
  const lookOf = useCallback((_id: string, base: StarLook): StarLook => {
    if (!selected.has(base.standing)) return { ...base, hidden: true };
    if (singled && base.standing !== singled) return { ...base, muted: true };
    return base;
  }, [selected, singled]);
  return { selected, toggle, singled, setSingled, groups, toggleGroup, lookOf };
}
