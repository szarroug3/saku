"use client";

// A streamed shelf's state, apart from the Atlas's layout (the components
// review, 2026-09-07): the Words shelf is too big to send, so its cuts come
// from the server when a standing is picked (no standings are here to cut
// by) and its tiles come as the cuts near the viewport. The Atlas renders;
// this fetches and remembers.

import { useCallback, useEffect, useRef, useState } from "react";

import type { PrerequisiteGraph } from "@/sky/lib/graph";
import type { Standing } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

import type { AtlasLookup, AtlasSection } from "./sky-atlas";

export function useStreamedShelf({ shelf, filter, lookup, graph, bring }: {
  shelf: { id: string; streamed?: boolean } | undefined;
  filter: Standing | null;
  lookup: AtlasLookup;
  graph: PrerequisiteGraph;
  /** Takes fetched tiles into the items the Atlas draws from. */
  bring: (more: readonly SkyItem[]) => void;
}): {
  /** The shelf's cuts for the standing picked, once fetched, by `${shelf}:${standing}`. */
  streamedCuts: ReadonlyMap<string, readonly AtlasSection[]>;
  /** The key the current shelf and standing stream under, or null when nothing streams. */
  streamKey: string | null;
  /** Fetches the tiles for these ids that are not here yet, once each. */
  fetchTiles: (ids: readonly string[]) => void;
} {
  const [streamedCuts, setStreamedCuts] = useState<ReadonlyMap<string, readonly AtlasSection[]>>(new Map());
  const streamKey = shelf?.streamed && filter ? `${shelf.id}:${filter}` : null;
  useEffect(() => {
    if (!streamKey || streamedCuts.has(streamKey) || !shelf) return;
    let live = true;
    lookup.sections(shelf.id, filter!).then((cuts) => { if (live) setStreamedCuts((prev) => new Map(prev).set(streamKey, cuts)); });
    return () => { live = false; };
  }, [streamKey, streamedCuts, shelf, filter, lookup]);
  const fetching = useRef(new Set<string>());
  const fetchTiles = useCallback((ids: readonly string[]) => {
    const missing = ids.filter((id) => !graph.itemOf(id) && !fetching.current.has(id));
    if (!missing.length) return;
    for (const id of missing) fetching.current.add(id);
    lookup.tiles(missing).then((tiles) => bring(tiles)).catch(() => { for (const id of missing) fetching.current.delete(id); });
  }, [graph, lookup, bring]);
  return { streamedCuts, streamKey, fetchTiles };
}
