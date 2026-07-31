"use client";

// Client access to the app's saved lists — a thin read of the ListsProvider
// (src/lib/lists-provider.tsx), plus the pure helpers a caller uses to reason
// about a list it already holds. The fetch and the state used to live here, so
// every one of the eight call sites ran its own GET /api/lists on mount; they
// moved to the provider, mounted once above the app, and this is now a
// useContext over that one copy.

import { useContext } from "react";

import { ListsContext } from "@/lib/lists-provider";

// The pure membership helpers live in list-membership.ts (no React, so the node
// test runner can load them); re-exported here so the popover keeps importing
// the hook and the helpers it uses on it from one place.
export {
  isWritable,
  listToggle,
  countIn,
  type ListToggle,
} from "@/lib/list-membership";

/** Read the shared lists and their mutators. Loud when there is no ListsProvider
 * above — a screen rendering outside the app shell is a tree bug, and a silent
 * second fetch would hide it. */
export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists must be used within a ListsProvider");
  return ctx;
}
