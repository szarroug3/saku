"use client";

// SAK-111: warm the Library's shelf data on EVERY app page load, not just on
// first /library visit. useServerLookup (src/lib/library/use-server-lookup.ts)
// caches by `${fn.name}:${JSON.stringify(args)}` in a module-scope Map shared
// across every component that calls it — so this component and
// LibraryPageClient's own useServerLookup(getLibraryShelves, EMPTY_ARGS) call
// (src/components/library/library-page.tsx) land on the SAME cache entry as
// long as the args serialize the same way, which is why EMPTY_ARGS here is a
// plain `const EMPTY_ARGS: [] = []` mirroring that file rather than anything
// shared by reference.
//
// Mounted once from layout.tsx, outside the Library route, so the Server
// Action round trip starts right after the shell mounts — in the background,
// after hydration, never blocking whatever page the user actually landed on.
// By the time they navigate to /library the shelves are typically already
// cached and LibraryPageClient's own call resolves instantly instead of
// showing a loading state. Renders nothing.

import { getLibraryShelves } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";

const EMPTY_ARGS: [] = [];

export function LibraryPrefetch() {
  // persist: true (SAK-112) — mirrors the resolved value into IndexedDB, keyed
  // by CURRICULUM_VERSION, so a hard reload or a new tab seeds this from disk
  // instead of re-running the ~15,640-entry computation over the network every
  // time. See use-server-lookup.ts's header for why this is opt-in rather than
  // applied to every action.
  useServerLookup(getLibraryShelves, EMPTY_ARGS, { persist: true });
  return null;
}
