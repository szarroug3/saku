"use client";

// A selection over an ordered set of tiles: a plain pick selects one, a
// toggle adds or removes one, a range takes the run from the last plain or
// toggled pick to this one, in the order the tiles are on screen. The rules
// themselves are in src/sky/lib/select.ts; this holds them in React.

import { useCallback, useMemo, useState } from "react";

import type { OnPick } from "@/sky/components/atlas-grid";
import { afterPick, justThis, NOTHING } from "@/sky/lib/select";

interface Selection {
  ids: readonly string[];
  set: ReadonlySet<string>;
  /** The one selected, when exactly one is. */
  single: string | null;
  pick: OnPick;
  /** Select exactly this one. */
  only: (id: string) => void;
  /** Unselect everything, wherever it was picked. */
  clear: () => void;
}

export function useSelection(order: readonly string[], initial?: string): Selection {
  const [state, setState] = useState(() => (initial ? justThis(initial) : NOTHING));
  const { ids } = state;
  const set = useMemo(() => new Set(ids), [ids]);
  const pick = useCallback<OnPick>((id, how) => setState((prev) => afterPick(prev, order, id, how)), [order]);
  const only = useCallback((id: string) => setState(justThis(id)), []);
  const clear = useCallback(() => setState(NOTHING), []);
  return { ids, set, single: ids.length === 1 ? ids[0] : null, pick, only, clear };
}
