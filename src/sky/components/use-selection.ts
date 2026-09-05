"use client";

// A selection over an ordered set of tiles: a plain pick selects one, a
// toggle adds or removes one, a range takes the run from the last plain or
// toggled pick to this one, in the order the tiles are on screen.

import { useCallback, useMemo, useRef, useState } from "react";

import type { OnPick } from "@/sky/components/atlas-grid";

export interface Selection {
  ids: readonly string[];
  set: ReadonlySet<string>;
  /** The one selected, when exactly one is. */
  single: string | null;
  pick: OnPick;
  /** Select exactly this one. */
  only: (id: string) => void;
  clear: () => void;
}

export function useSelection(order: readonly string[], initial?: string): Selection {
  const [ids, setIds] = useState<readonly string[]>(initial ? [initial] : []);
  const anchor = useRef<string | null>(initial ?? null);
  const set = useMemo(() => new Set(ids), [ids]);
  const pick = useCallback<OnPick>((id, how) => {
    if (how.range && anchor.current) {
      const a = order.indexOf(anchor.current), b = order.indexOf(id);
      if (a >= 0 && b >= 0) {
        const run = order.slice(Math.min(a, b), Math.max(a, b) + 1);
        setIds((prev) => [...new Set([...prev, ...run])]);
        return;
      }
    }
    anchor.current = id;
    if (how.toggle) setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    else setIds([id]);
  }, [order]);
  const only = useCallback((id: string) => { anchor.current = id; setIds([id]); }, []);
  const clear = useCallback(() => setIds([]), []);
  return { ids, set, single: ids.length === 1 ? ids[0] : null, pick, only, clear };
}
