// The prerequisite tree a constellation is drawn from. Generic on purpose: a Branch nests other Branches
// and says nothing about what a level means, so the same type serves
// word -> kanji -> radical today and whatever else grows on a cart tomorrow.
// See SAK-308.

import type { SkyItem } from "@/sky/lib/types";

export interface Branch {
  id: string;
  item: SkyItem;
  branches: Branch[];
}

/**
 * Turns a flat cart (every item the learner has, each optionally listing the
 * IDs of the items it's built from via `components`) into the `Branch[]`
 * forest the sky renders: one top-level branch per item that is nobody
 * else's component, each recursively holding branches for its own parts.
 *
 * An item referenced as a component of more than one other item is cloned
 * into a separate Branch per parent — the tree is about what's visible on
 * each path, not a shared graph, so a radical common to two kanji grows a
 * flower under each.
 */
export function buildBranches(cart: readonly SkyItem[]): Branch[] {
  const byId = new Map(cart.map((item) => [item.id, item]));
  const componentIds = new Set(cart.flatMap((item) => item.components ?? []));
  const roots = cart.filter((item) => !componentIds.has(item.id));

  return roots.map((item) => buildBranch(item, byId, new Set()));
}

function buildBranch(
  item: SkyItem,
  byId: ReadonlyMap<string, SkyItem>,
  ancestors: ReadonlySet<string>,
): Branch {
  // Guards against a corrupt cart (a component cycle) recursing forever;
  // a well-formed cart never hits this.
  if (ancestors.has(item.id)) {
    return { id: item.id, item, branches: [] };
  }
  const path = new Set(ancestors).add(item.id);

  const branches = (item.components ?? [])
    .map((id) => byId.get(id))
    .filter((component): component is SkyItem => component !== undefined)
    .map((component) => buildBranch(component, byId, path));

  return { id: item.id, item, branches };
}
